import { base } from '$app/paths';

export interface UserscriptConfig {
	helpUrl: string;
	scriptUrl: string;
}

const DEFAULT_CONFIG: UserscriptConfig = {
	helpUrl: import.meta.env?.VITE_USERSCRIPT_HELP_URL ?? 'https://example.com/userscript-help',
	scriptUrl: `${base || ''}/backenduserscript/backend.user.js`
};

export function getUserscriptConfig(overrides?: Partial<UserscriptConfig>): UserscriptConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}
