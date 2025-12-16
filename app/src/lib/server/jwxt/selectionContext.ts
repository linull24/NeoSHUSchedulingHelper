import { getJwxtConfig } from '../../../config/jwxt';

export const REQUEST_FIELD_KEYS = [
	'rwlx',
	'xklc',
	'xkly',
	'bklx_id',
	'sfkkjyxdxnxq',
	'kzkcgs',
	'xqh_id',
	'jg_id_1',
	'njdm_id_1',
	'zyh_id_1',
	'gnjkxdnj',
	'zyh_id',
	'zyfx_id',
	'njdm_id',
	'bh_id',
	'bjgkczxbbjwcx',
	'xbm',
	'xslbdm',
	'mzm',
	'xz',
	'ccdm',
	'xsbj',
	'sfkknj',
	'sfkkzy',
	'kzybkxy',
	'sfznkx',
	'zdkxms',
	'sfkxq',
	'sfkcfx',
	'kkbk',
	'kkbkdj',
	'bklbkcj',
	'sfkgbcx',
	'sfrxtgkcxd',
	'tykczgxdcs',
	'xkxnm',
	'xkxqm',
	'kklxdm',
	'bbhzxjxb',
	'xkkz_id',
	'rlkz',
	'xkzgbj',
	'xszxzt',
	'txbsfrl',
	'xkxskcgskg',
	'rlzlkz',
	'cdrlkz',
	'jxbzcxskg',
	'sfyxsksjct'
] as const;

export const DEFAULT_FIELD_VALUES: Record<string, string> = {
	rwlx: '1',
	xklc: '1',
	xkly: '1',
	bklx_id: '0',
	sfkkjyxdxnxq: '0',
	kzkcgs: '0',
	sfkknj: '1',
	sfkkzy: '1',
	kzybkxy: '0',
	sfznkx: '0',
	zdkxms: '0',
	sfkxq: '1',
	sfkcfx: '1',
	kkbk: '0',
	kkbkdj: '0',
	bklbkcj: '0',
	sfkgbcx: '1',
	sfrxtgkcxd: '1',
	tykczgxdcs: '0',
	bbhzxjxb: '0',
	rlkz: '0',
	xkzgbj: '0',
	xszxzt: '1',
	sfyxsksjct: '0'
};

export type SelectionPageFields = Record<string, string>;
export type JwxtContext = Record<string, string>;

export function buildSelectionIndexUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.selectionIndexPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildCourseListUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.courseListPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildCourseDetailUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.courseDetailPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildSelectedCoursesUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.selectedCoursesPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildEnrollUrl(): string {
	const cfg = getJwxtConfig();
	return new URL(cfg.enrollPath, cfg.jwxtHost).toString();
}

export function buildDropUrl(): string {
	const cfg = getJwxtConfig();
	return new URL(cfg.dropPath, cfg.jwxtHost).toString();
}

export function buildSsoEntryUrl(): string {
	const cfg = getJwxtConfig();
	return new URL(cfg.ssoEntryPath, cfg.jwxtHost).toString();
}

function findAllInputTags(html: string): string[] {
	const tags: string[] = [];
	const re = /<input\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		tags.push(match[0]);
	}
	return tags;
}

function parseAttributes(tag: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(tag)) !== null) {
		const key = match[1];
		const value = match[3] ?? match[4] ?? '';
		out[key] = value;
	}
	return out;
}

export function parseSelectionPageFields(html: string): SelectionPageFields {
	const fields: SelectionPageFields = {};
	for (const tag of findAllInputTags(html)) {
		const attrs = parseAttributes(tag);
		const id = attrs.id;
		if (!id) continue;
		fields[id] = attrs.value ?? '';
	}
	return fields;
}

export function buildQueryContext(fields: SelectionPageFields): JwxtContext {
	const params: JwxtContext = { ...DEFAULT_FIELD_VALUES };

	for (const key of REQUEST_FIELD_KEYS) {
		const value = fields[key];
		if (typeof value === 'string' && value !== '') {
			params[key] = value;
		}
	}

	params.xkkz_id = fields.firstXkkzId || params.xkkz_id || '';
	params.kklxdm = fields.firstKklxdm || params.kklxdm || '';
	params.njdm_id = fields.firstNjdmId || params.njdm_id || '';
	params.zyh_id = fields.firstZyhId || params.zyh_id || '';

	if (!params.xkkz_id) {
		throw new Error('Missing xkkz_id in selection page');
	}
	return params;
}
