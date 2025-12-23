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
	scriptUrl: import.meta.env?.VITE_USERSCRIPT_INSTALL_URL ?? `${base || ''}/backenduserscript/backend.user.js`
};

export function getUserscriptConfig(overrides?: Partial<UserscriptConfig>): UserscriptConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}
