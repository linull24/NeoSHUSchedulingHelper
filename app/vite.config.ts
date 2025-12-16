import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { swc } from 'rollup-plugin-swc3';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: __dirname,
	define: {
		global: 'globalThis'
	},
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: 'globalThis'
			}
		}
	},
	plugins: [
		UnoCSS(),
		sveltekit(),
		swc({
			include: ['src/**/*.{js,ts}'],
			exclude: ['node_modules/**'],
			jsc: {
				parser: {
					syntax: 'typescript',
					tsx: false,
					decorators: false
				},
				target: 'es2022',
				keepClassNames: true
			}
		})
	],
	// Disable Vite's default esbuild TS transpilation since SWC handles it now.
	esbuild: false,
	server: {
		fs: {
			allow: [path.resolve(__dirname, '..')]
		}
	}
});
