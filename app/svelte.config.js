import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

function resolveBasePath() {
	const explicit = process.env.BASE_PATH;
	if (explicit != null) return explicit;
	const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
	return repo ? `/${repo}` : '';
}

const config = {
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
			base: resolveBasePath(),
			relative: false
		},
		prerender: {
			entries: ['*']
		}
	}
};

export default config;
