export interface JwxtConfig {
	jwxtHost: string;
	ssoEntryPath: string;
	selectionIndexPath: string;
	courseListPath: string;
	courseDetailPath: string;
	selectedCoursesPath: string;
	enrollPath: string;
	dropPath: string;
	defaultGnmkdm: string;
}

const DEFAULT_CONFIG: JwxtConfig = {
	jwxtHost: import.meta.env?.VITE_JWXT_HOST ?? 'https://jwxt.shu.edu.cn',
	ssoEntryPath: '/sso/shulogin',
	selectionIndexPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html',
	courseListPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html',
	courseDetailPath: '/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html',
	selectedCoursesPath: '/jwglxt/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html',
	enrollPath: '/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html',
	dropPath: '/jwglxt/xsxk/zzxkyzbjk_tuikb.html',
	defaultGnmkdm: import.meta.env?.VITE_JWXT_GNMKDM ?? 'N253512'
};

export function getJwxtConfig(overrides?: Partial<JwxtConfig>): JwxtConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}

