#!/usr/bin/env node
/**
 * memory-chunk-upload.js
 *
 * Usage:
 *   node scripts/memory-chunk-upload.js \
 *     --uri "spec://cluster/ui-templates#chunk-01" \
 *     --file docs/memory-chunks/ui-templates.md \
 *     --name "Chunk 01"
 *
 * Reads a staging markdown file containing multiple chunk sections, extracts the
 * section matching the given URI (via `## spec://...` header), and sends it to
 * the MCP memory server using the MCP CLI binary (`npx @modelcontextprotocol/cli`)
 * or any configured command.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === '--uri') opts.uri = value;
    else if (key === '--file') opts.file = value;
    else if (key === '--name') opts.name = value;
    else throw new Error(`Unknown argument ${key}`);
  }
  if (!opts.uri || !opts.file) {
    throw new Error('Usage: node scripts/memory-chunk-upload.js --uri <spec://...> --file <path> [--name <display-name>]');
  }
  return opts;
}

function extractChunk(filePath, uri) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = content.split(/##\s+/).slice(1); // drop title
  for (const section of sections) {
    const [headerLine, ...rest] = section.split('\n');
    const header = headerLine.trim();
    if (header.startsWith(uri)) {
      return rest.join('\n').trim();
    }
  }
  throw new Error(`Chunk ${uri} not found in ${filePath}`);
}

function uploadChunk(uri, data) {
  const payload = JSON.stringify({ uri, data });
  const cli = process.env.MCP_MEMORY_CLI || 'npx';
  const args = cli === 'npx'
    ? ['@modelcontextprotocol/cli', 'memory', 'write', '--input', payload]
    : [cli, 'memory', 'write', '--input', payload];
  const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Failed to write memory chunk ${uri}`);
  }
}

function main() {
  const { uri, file, name } = parseArgs();
  const absFile = path.resolve(file);
  const chunkData = extractChunk(absFile, uri);
  const memo = name ? `# ${name}\n${chunkData}` : chunkData;
  uploadChunk(uri, memo);
  console.log(`✅ Uploaded ${uri}`);
}

main();
