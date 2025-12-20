export interface JwxtConfig {
	jwxtHost: string;
	ssoEntryPath: string;
	/**
	 * Absolute URL used to start the SSO flow.
	 *
	 * Important: `jwxt.shu.edu.cn` currently redirects from HTTPS root to an HTTP SSO entry,
	 * and starting the flow from the wrong scheme may lead to `/jwglxt/xtgl/login_slogin.html`
	 * (JWXT local login page) instead of `newsso.shu.edu.cn`.
	 */
	ssoEntryUrl: string;
	selectionIndexPath: string;
	selectionDisplayPath: string;
	courseListPath: string;
	courseDetailPath: string;
	selectedCoursesPath: string;
	enrollPath: string;
	dropPath: string;
	enrollmentBreakdownPath: string;
	defaultGnmkdm: string;
	crawlConcurrency: number;
	crawlAllCampuses: boolean;
}

function parseIntWithDefault(raw: string | undefined, fallback: number) {
	if (!raw) return fallback;
	const value = Number.parseInt(raw, 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseBooleanWithDefault(raw: string | undefined, fallback: boolean) {
	if (raw == null) return fallback;
	const text = String(raw).trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(text)) return true;
	if (['0', 'false', 'no', 'off'].includes(text)) return false;
	return fallback;
}

function deriveDefaultSsoEntryUrl(jwxtHost: string, ssoEntryPath: string): string {
	const url = new URL(jwxtHost);
	// Force http for the entry to reliably trigger `newsso.shu.edu.cn` redirects.
	url.protocol = 'http:';
	url.pathname = ssoEntryPath;
	url.search = '';
	url.hash = '';
	return url.toString();
}

const DEFAULT_CONFIG: JwxtConfig = {
	jwxtHost: import.meta.env?.VITE_JWXT_HOST ?? 'https://jwxt.shu.edu.cn',
	ssoEntryPath: '/sso/shulogin',
	ssoEntryUrl:
		import.meta.env?.VITE_JWXT_SSO_ENTRY_URL ??
		deriveDefaultSsoEntryUrl(import.meta.env?.VITE_JWXT_HOST ?? 'https://jwxt.shu.edu.cn', '/sso/shulogin'),
	selectionIndexPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html',
	selectionDisplayPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbDisplay.html',
	courseListPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html',
	courseDetailPath: '/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html',
	selectedCoursesPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html',
	enrollPath: '/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html',
	dropPath: '/jwglxt/xsxk/zzxkyzbjk_tuikb.html',
	enrollmentBreakdownPath: '/jwglxt/xkgl/common_cxJxbrsmxIndex.html',
	defaultGnmkdm: import.meta.env?.VITE_JWXT_GNMKDM ?? 'N253512',
	crawlConcurrency: parseIntWithDefault(import.meta.env?.VITE_JWXT_CRAWL_CONCURRENCY, 20),
	crawlAllCampuses: parseBooleanWithDefault(import.meta.env?.VITE_JWXT_CRAWL_ALL_CAMPUSES, true)
};

export function getJwxtConfig(overrides?: Partial<JwxtConfig>): JwxtConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}
