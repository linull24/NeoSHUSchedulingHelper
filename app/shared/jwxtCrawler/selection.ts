import { parseSelectOptions, stripHtml, type JwxtSelectOption } from './html';

export type JwxtRoundTab = {
	kklxdm: string;
	xkkzId: string;
	njdmId: string;
	zyhId: string;
	kklxLabel: string;
	active: boolean;
};

export type SelectionIndexParsed = {
	indexFields: Record<string, string>;
	indexRoundMeta: { xklc?: string; xklcmc?: string };
	tabs: JwxtRoundTab[];
	activeXkkzId: string;
	selectedTab: JwxtRoundTab | null;
	mergedFieldsBase: Record<string, string>;
};

export function applyRoundMetaFallback(fields: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = { ...fields };
	// Some pages expose round info via txt_xklc/txt_xklcmc (term-system dependent).
	if (!out.xklc && (out as any).txt_xklc) (out as any).xklc = (out as any).txt_xklc;
	if (!out.xklcmc && (out as any).txt_xklcmc) (out as any).xklcmc = (out as any).txt_xklcmc;
	return out;
}

export function mergeFieldsPreferNonEmpty(
	base: Record<string, string>,
	update: Record<string, string>
): Record<string, string> {
	const out: Record<string, string> = { ...base };
	for (const [key, value] of Object.entries(update)) {
		const v = String(value ?? '');
		if (v !== '') out[key] = v;
	}
	return out;
}

export function extractRoundMetaFromHtml(html: string): { xklc?: string; xklcmc?: string } {
	const out: { xklc?: string; xklcmc?: string } = {};

	const inputValue = (id: string): string => {
		const tagRe = new RegExp(`<input\\b[^>]*\\bid\\s*=\\s*(\"${id}\"|'${id}'|${id})\\b[^>]*>`, 'i');
		const mTag = tagRe.exec(html);
		const tag = mTag?.[0] ?? '';
		if (!tag) return '';
		const valueRe = /\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
		const mValue = valueRe.exec(tag);
		return String(mValue?.[1] ?? mValue?.[2] ?? mValue?.[3] ?? '').trim();
	};

	const xklc = inputValue('xklc');
	const xklcmc = inputValue('xklcmc');
	if (xklc) out.xklc = xklc;
	if (xklcmc) out.xklcmc = xklcmc;

	if (!out.xklcmc) {
		const re = /\bid\s*=\s*("txt_xklc"|'txt_xklc'|txt_xklc)\b[^>]*>([\s\S]*?)<\/[a-z0-9:_-]+>/i;
		const m = re.exec(html);
		const text = m ? stripHtml(m[2] ?? '') : '';
		if (text) out.xklcmc = text;
	}

	if (!out.xklc && out.xklcmc) {
		const m = /第\s*([0-9]+)\s*轮/.exec(out.xklcmc);
		if (m?.[1]) out.xklc = m[1].trim();
	}

	return out;
}

export function parseSelectionIndexHtml(input: {
	indexHtml: string;
	preferredXkkzId?: string | null | undefined;
}): SelectionIndexParsed {
	const indexHtml = input.indexHtml;
	const indexFields = parseSelectionPageFields(indexHtml);
	const indexRoundMeta = extractRoundMetaFromHtml(indexHtml);
	let tabs = parseSelectionRoundTabs(indexHtml);

	// Some term-system deployments render no <li> round tabs (single-round UI).
	// In that case, fall back to the hidden fields so server/userscript can still operate.
	if (!tabs.length) {
		const fallbackXkkzId = String((indexFields as any).firstXkkzId || (indexFields as any).xkkz_id || '').trim();
		if (fallbackXkkzId) {
			tabs = [
				{
					xkkzId: fallbackXkkzId,
					kklxdm: String((indexFields as any).firstKklxdm || (indexFields as any).kklxdm || '').trim() || '1',
					njdmId: String((indexFields as any).firstNjdmId || (indexFields as any).njdm_id || '').trim(),
					zyhId: String((indexFields as any).firstZyhId || (indexFields as any).zyh_id || '').trim(),
					kklxLabel:
						String((indexFields as any).firstKklxmc || (indexFields as any).kklxmc || '').trim() ||
						'选课',
					active: true
				}
			];
		}
	}

	const activeXkkzId = String((indexFields as any).firstXkkzId || (indexFields as any).xkkz_id || '').trim();
	const preferredXkkzId = String(input.preferredXkkzId ?? '').trim();
	const selectedTab = selectRoundTab({ fields: indexFields, tabs, preferredXkkzId: preferredXkkzId || activeXkkzId });

	let mergedFieldsBase: Record<string, string> = { ...indexFields };
	if (!(mergedFieldsBase as any).xklc && indexRoundMeta.xklc) (mergedFieldsBase as any).xklc = indexRoundMeta.xklc;
	if (!(mergedFieldsBase as any).xklcmc && indexRoundMeta.xklcmc) (mergedFieldsBase as any).xklcmc = indexRoundMeta.xklcmc;

	if (selectedTab) {
		mergedFieldsBase = {
			...mergedFieldsBase,
			firstKklxdm: selectedTab.kklxdm,
			firstKklxmc: selectedTab.kklxLabel || (mergedFieldsBase as any).firstKklxmc || '',
			firstXkkzId: selectedTab.xkkzId,
			firstNjdmId: selectedTab.njdmId || (mergedFieldsBase as any).firstNjdmId || '',
			firstZyhId: selectedTab.zyhId || (mergedFieldsBase as any).firstZyhId || ''
		};
	}

	return { indexFields, indexRoundMeta, tabs, activeXkkzId, selectedTab, mergedFieldsBase };
}

export function buildSelectionDisplayPayload(input: {
	indexFields: Record<string, string>;
	selectedTab: JwxtRoundTab;
}): URLSearchParams {
	const indexFields = input.indexFields;
	const selectedTab = input.selectedTab;
	return new URLSearchParams({
		xkkz_id: selectedTab.xkkzId,
		xszxzt: (indexFields as any).xszxzt || '1',
		kklxdm: selectedTab.kklxdm,
		njdm_id: selectedTab.njdmId,
		zyh_id: selectedTab.zyhId,
		kspage: '0',
		jspage: '0'
	});
}

export function mergeSelectionDisplayHtml(input: {
	mergedFieldsBase: Record<string, string>;
	displayHtml: string;
}): { mergedFields: Record<string, string>; campusOptions: JwxtSelectOption[] } {
	let mergedFields: Record<string, string> = { ...input.mergedFieldsBase };
	const displayHtml = input.displayHtml;
	const displayFields = parseSelectionPageFields(displayHtml);
	const displayRoundMeta = extractRoundMetaFromHtml(displayHtml);

	// Campus options are exposed on the Display page.
	const campusOptions = parseSelectOptions(displayHtml, 'xqh_id');

	if (campusOptions.length) {
		const selectedCampus = campusOptions.find((opt) => opt.selected)?.value ?? '';
		if (selectedCampus) mergedFields = { ...mergedFields, xqh_id: selectedCampus };
	}

	mergedFields = mergeFieldsPreferNonEmpty(mergedFields, displayFields);
	if (!(mergedFields as any).xklc && displayRoundMeta.xklc) (mergedFields as any).xklc = displayRoundMeta.xklc;
	if (!(mergedFields as any).xklcmc && displayRoundMeta.xklcmc) (mergedFields as any).xklcmc = displayRoundMeta.xklcmc;

	return { mergedFields, campusOptions };
}

export function finalizeSelectionContext(input: {
	mergedFields: Record<string, string>;
	tabs: JwxtRoundTab[];
	activeXkkzId: string;
}): { fields: Record<string, string>; context: Record<string, string>; activeXkkzId: string; currentXkkzId: string | null } {
	const mergedFields = applyRoundMetaFallback(input.mergedFields);
	const context = buildQueryContext(mergedFields);
	return {
		fields: mergedFields,
		context,
		activeXkkzId: input.activeXkkzId || (input.tabs.find((tab) => tab.active)?.xkkzId ?? ''),
		currentXkkzId: context.xkkz_id || null
	};
}

export function selectRoundTab(input: {
	fields: Record<string, string>;
	tabs: JwxtRoundTab[];
	preferredXkkzId?: string | null | undefined;
}): JwxtRoundTab | null {
	const fields = input.fields;
	const tabs = input.tabs;
	const preferredXkkzId = String(input.preferredXkkzId ?? '').trim();
	const activeXkkzId = String((fields as any).firstXkkzId || (fields as any).xkkz_id || '').trim();

	const fallbackXkkzId = String((fields as any).firstXkkzId || (fields as any).xkkz_id || '').trim();
	const fallbackTab: JwxtRoundTab | null =
		fallbackXkkzId
			? {
					xkkzId: fallbackXkkzId,
					kklxdm: String((fields as any).firstKklxdm || (fields as any).kklxdm || ''),
					njdmId: String((fields as any).firstNjdmId || (fields as any).njdm_id || ''),
					zyhId: String((fields as any).firstZyhId || (fields as any).zyh_id || ''),
					kklxLabel: String((fields as any).kklxmc || ''),
					active: true
				}
			: null;

	return (
		(preferredXkkzId ? tabs.find((tab) => tab.xkkzId === preferredXkkzId) : null) ??
		(activeXkkzId ? tabs.find((tab) => tab.xkkzId === activeXkkzId) : null) ??
		tabs.find((tab) => tab.active) ??
		tabs[0] ??
		fallbackTab ??
		null
	);
}

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
	// Term-system upgrades added/removed a few "capacity/round policy" flags over time.
	// Keep them in the context even if we don't fully understand semantics yet (see roundPolicy.ts).
	'xkkzrlsrlmxsfs',
	'sxrlkzlx',
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
	// Capacity/over-enroll related flags.
	// These are term-system dependent and sometimes omitted from the HTML.
	// Keep conservative defaults to match observed UI payloads.
	cdrlkz: '0',
	rlzlkz: '1',
	xkzgbj: '0',
	xszxzt: '1',
	sfyxsksjct: '0',
	// Drop endpoint `/xsxk/zzxkyzb_tuikBcZzxkYzb.html` expects this (usually 0).
	txbsfrl: '0'
};

export function parseSelectionPageFields(html: string): Record<string, string> {
	const fields: Record<string, string> = {};
	const re = /<input\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		const tag = match[0];
		const attrs: Record<string, string> = {};
		const quotedAttrRe = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
		const unquotedAttrRe = /([a-zA-Z0-9:_-]+)\s*=\s*([^\s"'=<>`]+)/g;
		let m: RegExpExecArray | null;
		while ((m = quotedAttrRe.exec(tag)) !== null) {
			const key = m[1];
			const value = m[3] != null ? m[3] : m[4] != null ? m[4] : '';
			attrs[key] = value;
		}
		while ((m = unquotedAttrRe.exec(tag)) !== null) {
			const key = m[1];
			if (attrs[key] != null) continue;
			const value = m[2] != null ? m[2] : '';
			attrs[key] = value;
		}
		// Term-system upgrades sometimes drop `id` attributes; fall back to `name`.
		const key = attrs.id || attrs.name;
		if (!key) continue;
		fields[key] = attrs.value != null ? attrs.value : '';
	}
	return fields;
}

export function parseSelectionRoundTabs(html: string) {
	const tabs: JwxtRoundTab[] = [];

	// Be resilient to term-system changes: JWXT may change the exact onclick signature/quoting,
	// but still embeds quoted args in the onclick string around `queryCourse(...)`.
	const re =
		/<li\b([^>]*)>\s*<a\b[^>]*onclick="([^"]*queryCourse[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		const liAttrs = match[1] ?? '';
		const onclick = match[2] ?? '';
		const innerHtml = match[3] ?? '';

		const args = Array.from(onclick.matchAll(/['"]([^'"]+)['"]/g)).map((m) => (m[1] ?? '').trim());
		const kklxdm = args[0] ?? '';
		const xkkzId = args[1] ?? '';
		const njdmId = args[2] ?? '';
		const zyhId = args[3] ?? '';
		const kklxLabel = stripHtml(innerHtml);
		if (!kklxdm || !xkkzId) continue;
		tabs.push({ kklxdm, xkkzId, njdmId, zyhId, kklxLabel, active: /\bactive\b/i.test(liAttrs) });
	}
	return tabs;
}

export function buildQueryContext(fields: Record<string, string>) {
	const params: Record<string, string> = { ...DEFAULT_FIELD_VALUES };
	for (const key of REQUEST_FIELD_KEYS) {
		const value = fields[key];
		if (typeof value === 'string' && value !== '') params[key] = value;
	}
	params.xkkz_id = (fields as any).firstXkkzId || params.xkkz_id || '';
	params.kklxdm = (fields as any).firstKklxdm || params.kklxdm || '';
	params.njdm_id = (fields as any).firstNjdmId || params.njdm_id || '';
	params.zyh_id = (fields as any).firstZyhId || params.zyh_id || '';
	if (!params.xkkz_id) throw new Error('Missing xkkz_id in selection page');

	// Compatibility with ref implementations: some endpoints expect `xnm/xqm` rather than `xkxnm/xkxqm`.
	// Keep them duplicated to reduce breakage across term-system changes.
	if (!params.xnm && params.xkxnm) params.xnm = params.xkxnm;
	if (!params.xqm && params.xkxqm) params.xqm = params.xkxqm;
	return params;
}
