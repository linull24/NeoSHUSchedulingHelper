import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as swc from '@swc/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const metaPath = path.join(repoRoot, 'app', 'static', 'backenduserscript', 'meta.json');
const entryPath = path.join(repoRoot, 'app', 'static', 'backenduserscript', 'src', 'index.ts');
const outPath = path.join(repoRoot, 'app', 'static', 'backenduserscript', 'backend.user.js');
const userConfigPath = path.join(repoRoot, 'app', 'static', 'backenduserscript', 'userconfig', 'config.json');
const userConfigLocalPath = path.join(repoRoot, 'app', 'static', 'backenduserscript', 'userconfig', 'local.json');

function line(key, value) {
  return `// @${key.padEnd(12)} ${value}`;
}

function makeMetadata(meta) {
  const lines = [];
  lines.push('// ==UserScript==');
  lines.push(line('name', meta.name));
  lines.push(line('namespace', meta.namespace));
  lines.push(line('version', meta.version));
  lines.push(line('description', meta.description));
  if (meta.homepageURL) lines.push(line('homepageURL', meta.homepageURL));
  if (meta.updateURL) lines.push(line('updateURL', meta.updateURL));
  if (meta.downloadURL) lines.push(line('downloadURL', meta.downloadURL));

  for (const pattern of meta.match || []) lines.push(line('match', pattern));
  for (const pattern of meta.include || []) lines.push(line('include', pattern));
  for (const grant of meta.grant || []) lines.push(line('grant', grant));
  for (const host of meta.connect || []) lines.push(line('connect', host));

  lines.push(line('run-at', meta.runAt || 'document-start'));
  lines.push('// ==/UserScript==');
  // IMPORTANT:
  // Userscript managers expect a blank line after the metadata block, otherwise the first JS statement
  // may be treated as metadata continuation in some parsers.
  lines.push('');
  lines.push('');
  // IMPORTANT:
  // This file is minified and not meant for reading/editing. Please refer to the repo sources instead.
  lines.push('// NOTE: This file is generated. Do NOT edit it here.');
  lines.push('// Source: app/static/backenduserscript/src/index.ts');
  lines.push('// Build:  app/scripts/build-userscript.mjs');
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

async function swcMinifyPreservingHeader(outFile, header) {
  const raw = await fs.readFile(outFile, 'utf8');
  if (!raw.startsWith(header)) {
    throw new Error('[userscript] output does not start with expected header; aborting minify');
  }
  const body = raw.slice(header.length);
  const result = await swc.minify(body, {
    compress: {
      passes: 2,
      keep_infinity: true
    },
    mangle: true,
    format: {
      comments: false
    }
  });
  const code = typeof result?.code === 'string' ? result.code : body;
  await fs.writeFile(outFile, `${header}${code.trim()}\n`, 'utf8');
}

async function main() {
  const metaRaw = await fs.readFile(metaPath, 'utf8');
  const meta = JSON.parse(metaRaw);

  const userConfigBase = JSON.parse(await fs.readFile(userConfigPath, 'utf8'));
  let userConfigLocal = {};
  try {
    userConfigLocal = JSON.parse(await fs.readFile(userConfigLocalPath, 'utf8'));
  } catch {
    // optional
  }
  const userConfig = { ...(userConfigBase || {}), ...(userConfigLocal || {}) };

  const minify = process.env.MINIFY === '1' || process.argv.includes('--minify');
  const minifyViaSwc = process.env.SWC === '1' || process.argv.includes('--swc');
  const watch = process.argv.includes('--watch');

  const header = makeMetadata(meta);
  const userscriptMarkerPrelude = [
    '// [userscript-prelude] Installation marker for the web UI:',
    "// - Lets the UI distinguish 'userscript not installed' vs 'installed but not yet logged in/fetched batch'.",
    "// - Runs before the bundled code so it still marks even if the main bundle throws early.",
    `(() => {`,
    `  try {`,
    `    const key = 'shuoscJwxtUserscript';`,
    `    const val = ${JSON.stringify(String(meta.version || '1'))};`,
    `    const set = () => {`,
    `      try {`,
    `        if (typeof document === 'undefined' || !document.documentElement) return false;`,
    `        document.documentElement.dataset[key] = val;`,
    `        return true;`,
    `      } catch {`,
    `        return false;`,
    `      }`,
    `    };`,
    `    if (!set() && typeof document !== 'undefined' && document.addEventListener) {`,
    `      document.addEventListener('DOMContentLoaded', () => set(), { once: true });`,
    `    }`,
    `  } catch {`,
    `    // ignore`,
    `  }`,
    `})();`,
    ''
  ].join('\n');
  const configBanner = [
    '// [userscript-config] Generated from:',
    `// - ${path.relative(repoRoot, userConfigPath)}`,
    `// - ${path.relative(repoRoot, userConfigLocalPath)} (optional, gitignored)`,
    `const __USERSCRIPT_CONFIG__ = ${JSON.stringify(userConfig)};`,
    userscriptMarkerPrelude,
    ''
  ].join('\n');
  const ctx = await esbuild.context({
    entryPoints: [entryPath],
    outfile: outPath,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2017'],
    legalComments: 'none',
    // Minify via SWC so we can keep the userscript header intact and get better compression.
    minify: Boolean(minify && !minifyViaSwc),
    sourcemap: false,
    banner: {
      js: `${header}${configBanner}`
    },
    define: {
      __USERSCRIPT_VERSION__: JSON.stringify(meta.version)
    }
  });

  try {
    if (watch) {
      await ctx.watch();
      // keep process alive
      // eslint-disable-next-line no-console
      console.log(`[userscript] watching -> ${outPath}`);
    } else {
      await ctx.rebuild();
      if (minify && minifyViaSwc) {
        await swcMinifyPreservingHeader(outPath, header);
      }
      // eslint-disable-next-line no-console
      console.log(`[userscript] built -> ${outPath}`);
      await ctx.dispose();
    }
  } catch (err) {
    await ctx.dispose();
    throw err;
  }
}

await main();
