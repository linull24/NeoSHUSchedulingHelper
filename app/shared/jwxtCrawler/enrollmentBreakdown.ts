import { stripHtml } from './html';

export type JwxtEnrollmentBreakdownItem = {
	/**
	 * Human-readable label as rendered by JWXT.
	 * Examples (observed): 预置已选人数 / 培养方案已选人数 / 高年级已选人数 / 其他已选人数 / 总计
	 */
	label: string;
	/**
	 * Parsed integer value if present.
	 */
	value: number | null;
	/**
	 * Raw value text after HTML stripping (useful when JWXT changes formatting).
	 */
	rawValueText: string;
	/**
	 * Raw marker text (3rd column) after HTML stripping.
	 * Some deployments may use this column to indicate the current user's cohort/batch membership.
	 */
	rawMarkerText?: string;
	/**
	 * Some deployments mark certain rows (e.g. "其他已选人数★").
	 * Keep as a hint only; semantics TBD.
	 */
	marker?: 'star';
};

export type JwxtEnrollmentBreakdown = {
	/**
	 * Optional table header (first row).
	 * Observed: ["类型","数值","所属类型"]
	 */
	header?: string[];
	items: JwxtEnrollmentBreakdownItem[];
	total: number | null;
	/**
	 * If the table marks the current user's cohort/batch on exactly one row (e.g. via ★ in 3rd column),
	 * this is the corresponding label.
	 *
	 * IMPORTANT: This is USER-SPECIFIC signal; do not persist into cloud snapshots.
	 */
	userBatchLabel?: string;
};

function pickStr(obj: Record<string, unknown> | null | undefined, key: string): string {
	const v = obj ? (obj as any)[key] : undefined;
	return String(v ?? '').trim();
}

function parseIntLoose(text: string): number | null {
	const cleaned = String(text || '').replace(/[^\d-]+/g, '').trim();
	if (!cleaned) return null;
	const n = Number.parseInt(cleaned, 10);
	return Number.isFinite(n) ? n : null;
}

export function buildEnrollmentBreakdownPayload(
	context: Record<string, unknown>,
	input: { kch_id: string; jxb_id: string; xnm?: string; xqm?: string }
): URLSearchParams {
	const ctx = context ?? {};
	const xnm = String(input.xnm ?? '').trim() || pickStr(ctx, 'xnm') || pickStr(ctx, 'xkxnm');
	const xqm = String(input.xqm ?? '').trim() || pickStr(ctx, 'xqm') || pickStr(ctx, 'xkxqm');
	if (!xnm || !xqm) throw new Error('Missing xnm/xqm for enrollment breakdown');
	return new URLSearchParams({
		kch_id: String(input.kch_id || '').trim(),
		jxb_id: String(input.jxb_id || '').trim(),
		xnm,
		xqm
	});
}

/**
 * Parse JWXT "已选人数明细" HTML (`/xkgl/common_cxJxbrsmxIndex.html`) into structured items.
 *
 * NOTE:
 * - This is NOT the user's cohort/batch membership; it's a breakdown of enrolled headcount by categories.
 * - "User batch membership" remains TBD and must be derived at runtime (userscript) from user profile signals.
 */
export function parseEnrollmentBreakdownHtml(html: string): JwxtEnrollmentBreakdown {
	const text = String(html || '');
	const items: JwxtEnrollmentBreakdownItem[] = [];
	let header: string[] | undefined;
	let userBatchLabel: string | undefined;

	const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
	let row: RegExpExecArray | null;
	while ((row = rowRe.exec(text)) !== null) {
		const rowHtml = row[1] || '';
		const cells: string[] = [];
		const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
		let cell: RegExpExecArray | null;
		while ((cell = cellRe.exec(rowHtml)) !== null) {
			cells.push(stripHtml(cell[1] || ''));
		}
		if (cells.length < 2) continue;
		const labelRaw = cells[0] || '';
		const valueRaw = cells[1] || '';
		const markerRaw = cells[2] || '';
		const label = labelRaw.replace(/\s+/g, ' ').trim();
		const rawValueText = valueRaw.replace(/\s+/g, ' ').trim();
		if (!label) continue;

		// Header row usually looks like: 类型 / 数值 / 所属类型
		if (label === '类型' && rawValueText === '数值') {
			header = cells.map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
			continue;
		}

		// Marker may appear in a dedicated 3rd column ("所属类型") or in label itself.
		const rawMarkerText = markerRaw.replace(/\s+/g, ' ').trim();
		const marker: 'star' | undefined =
			label.includes('★') || rawMarkerText.includes('★') ? 'star' : undefined;
		const normalizedLabel = label.replace(/★/g, '').trim();
		const value = parseIntLoose(rawValueText);
		if (marker === 'star' && !userBatchLabel) userBatchLabel = normalizedLabel;
		items.push({
			label: normalizedLabel,
			value,
			rawValueText,
			...(rawMarkerText ? { rawMarkerText } : {}),
			...(marker ? { marker } : {})
		});
	}

	if (!items.length) {
		throw new Error('Failed to parse enrollment breakdown HTML (no table rows)');
	}

	const totalRow =
		items.find((it) => it.label === '总计') ||
		items.find((it) => it.label.includes('总计')) ||
		null;

	return {
		...(header ? { header } : {}),
		items,
		total: totalRow?.value ?? null,
		...(userBatchLabel ? { userBatchLabel } : {})
	};
}
