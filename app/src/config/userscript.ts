import { base } from '$app/paths';

export interface UserscriptConfig {
	helpUrl: string;
	scriptUrl: string;
}

function resolveRepoSlug() {
	return import.meta.env?.VITE_GITHUB_REPO ?? '129s/NeoSHUSchedulingHelper';
}

const DEFAULT_CONFIG: UserscriptConfig = {
	helpUrl:
		import.meta.env?.VITE_USERSCRIPT_HELP_URL ??
		`https://github.com/${resolveRepoSlug()}#readme`,
	// Prefer `.user.js` suffix to ensure userscript managers trigger install reliably.
	//
	// On GitHub Pages, some setups (e.g. service worker, COOP/COEP headers, or routing fallbacks)
	// can interfere with userscript managers' install interception. A raw.githubusercontent.com
	// URL is the most stable install source.
	scriptUrl: import.meta.env?.PROD
		? import.meta.env?.VITE_USERSCRIPT_INSTALL_URL ??
			`https://raw.githubusercontent.com/${resolveRepoSlug()}/main/app/static/backenduserscript/backend.user.js`
		: `${base || ''}/backenduserscript/backend.user.js`
};

export function getUserscriptConfig(overrides?: Partial<UserscriptConfig>): UserscriptConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}
