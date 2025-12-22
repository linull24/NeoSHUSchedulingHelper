// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		__shuDebug?: Record<string, any>;
	}

interface ImportMetaEnv {
		readonly PUBLIC_GITHUB_CLIENT_ID?: string;
		readonly PUBLIC_GITHUB_OAUTH_PROXY_URL?: string;
		readonly PUBLIC_GITHUB_ALLOW_MANUAL_TOKEN?: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}

	declare module '*.scss';
}

export {};
