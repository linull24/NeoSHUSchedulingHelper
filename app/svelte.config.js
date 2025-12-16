import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const dev = process.argv.includes('dev');
const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
const base = dev ? '' : process.env.BASE_PATH ?? (repoName ? `/${repoName}` : '');

const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base
		},
		prerender: {
			entries: ['*']
		}
	}
};

export default config;
