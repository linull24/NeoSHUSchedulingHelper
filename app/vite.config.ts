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
	base: process.env.BASE_PATH ?? '',
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: 'globalThis'
			}
		}
	},
	plugins: [
		sveltekit(),
		UnoCSS(),
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
	server: {
		headers: {
			// SharedArrayBuffer / wasm pthreads (Z3, DuckDB coi) require cross-origin isolation.
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		},
		fs: {
			allow: [path.resolve(__dirname, '..')]
		}
	},
	preview: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	},
	worker: {
		format: 'es',
		rollupOptions: {
			external: ['__sveltekit/*', '__sveltekit/*?*']
		},
		plugins() {
			return [
				{
					name: 'worker-sveltekit-env-stub',
					resolveId(id) {
						if (id === '__sveltekit/environment') return id;
					},
					load(id) {
						if (id === '__sveltekit/environment') {
							return 'export const browser = false; export const dev = false; export const building = true; export const version = "0.0.0";';
						}
					}
				}
			];
		}
	}
});
