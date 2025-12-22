import { base } from '$app/paths';

export interface UserscriptConfig {
	helpUrl: string;
	scriptUrl: string;
}

const DEFAULT_CONFIG: UserscriptConfig = {
	helpUrl:
		import.meta.env?.VITE_USERSCRIPT_HELP_URL ??
		`https://github.com/${import.meta.env?.VITE_GITHUB_REPO ?? '129s/NeoSHUSchedulingHelper'}#readme`,
	// Prefer `.user.js` suffix to ensure userscript managers trigger install reliably.
	scriptUrl: `${base || ''}/backenduserscript/backend.user.js`
};

export function getUserscriptConfig(overrides?: Partial<UserscriptConfig>): UserscriptConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}
