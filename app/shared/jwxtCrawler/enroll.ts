import { REQUEST_FIELD_KEYS } from './selection';

export type CourseEnrollExtras = {
	kch_id: string;
	jxb_ids: string;
	kcmc?: string;
	qz?: string;
	xxkbj?: string;
	cxbj?: string;
	jcxx_id?: string;
};

function pickStr(obj: Record<string, unknown> | null | undefined, key: string): string {
	const v = obj ? (obj as any)[key] : undefined;
	return String(v ?? '').trim();
}

export function deriveSxbj(flags: { rlkz?: string; cdrlkz?: string; rlzlkz?: string }): string {
	const rlkz = String(flags.rlkz ?? '').trim();
	const cdrlkz = String(flags.cdrlkz ?? '').trim();
	const rlzlkz = String(flags.rlzlkz ?? '').trim();
	return rlkz === '1' || cdrlkz === '1' || rlzlkz === '1' ? '1' : '0';
}

export function buildEnrollPayload(context: Record<string, unknown>, extras: CourseEnrollExtras): URLSearchParams {
	const ctx = context ?? {};
	const payload: Record<string, string> = {
		jxb_ids: extras.jxb_ids,
		kch_id: extras.kch_id,
		kcmc: extras.kcmc ?? '',
		xxkbj: extras.xxkbj ?? '0',
		qz: extras.qz ?? '0',
		cxbj: extras.cxbj ?? '0',
		jcxx_id: extras.jcxx_id ?? ''
	};

	// Best-effort: include *all* context fields from the selection page (hidden inputs + derived context).
	// This matches the in-page enroll scripts and avoids server-side "无操作权限" when new fields are required.
	for (const [k, v] of Object.entries(ctx)) {
		if (k in payload) continue;
		const s = String(v ?? '').trim();
		if (!s) continue;
		payload[k] = s;
	}

	// Copy the selection-page query context fields into the enroll request payload.
	// JWXT term-system upgrades add/remove fields over time; sending the full context
	// (when available) matches the behavior of in-page scripts and avoids "无操作权限".
	for (const key of REQUEST_FIELD_KEYS) {
		if (key in payload) continue;
		const v = pickStr(ctx, key);
		if (v) payload[key] = v;
	}

	// These flags are derived fields used by the enroll endpoint.
	const rlkz = pickStr(ctx, 'rlkz');
	const cdrlkz = pickStr(ctx, 'cdrlkz');
	const rlzlkz = pickStr(ctx, 'rlzlkz');
	payload.rlkz = rlkz;
	payload.cdrlkz = cdrlkz;
	payload.rlzlkz = rlzlkz;
	payload.rwlx = pickStr(ctx, 'rwlx');
	payload.sxbj = deriveSxbj({ rlkz, cdrlkz, rlzlkz });

	// Some term-system versions expect xnm/xqm; keep them duplicated if present.
	const xnm = pickStr(ctx, 'xnm');
	const xqm = pickStr(ctx, 'xqm');
	if (xnm) payload.xnm = xnm;
	if (xqm) payload.xqm = xqm;

	return new URLSearchParams(payload);
}

export function buildDropPayload(context: Record<string, unknown>, input: { jxb_id: string }): URLSearchParams {
	const ctx = context ?? {};
	const payload: Record<string, string> = {
		xkkz_id: pickStr(ctx, 'xkkz_id'),
		jxb_id: input.jxb_id,
		bj: '10'
	};

	// Best-effort: include *all* context fields from the selection page (hidden inputs + derived context).
	// This matches the in-page scripts and avoids "非法访问/无操作权限" on term-system upgrades.
	for (const [k, v] of Object.entries(ctx)) {
		if (k in payload) continue;
		const s = String(v ?? '').trim();
		if (!s) continue;
		payload[k] = s;
	}

	const xnm = pickStr(ctx, 'xnm') || pickStr(ctx, 'xkxnm');
	const xqm = pickStr(ctx, 'xqm') || pickStr(ctx, 'xkxqm');
	if (xnm) payload.xnm = xnm;
	if (xqm) payload.xqm = xqm;
	return new URLSearchParams(payload);
}

export function buildDropPayloadTuikBcZzxkYzb(
	context: Record<string, unknown>,
	input: { kch_id: string; jxb_ids: string }
): URLSearchParams {
	const ctx = context ?? {};
	const payload: Record<string, string> = {
		kch_id: input.kch_id,
		jxb_ids: input.jxb_ids,
		xkxnm: pickStr(ctx, 'xkxnm') || pickStr(ctx, 'xnm'),
		xkxqm: pickStr(ctx, 'xkxqm') || pickStr(ctx, 'xqm'),
		txbsfrl: pickStr(ctx, 'txbsfrl')
	};

	// Best-effort: include full context fields (csrftoken/gnmkdmKey/etc.) to align with ref UI behavior.
	for (const [k, v] of Object.entries(ctx)) {
		if (k in payload) continue;
		const s = String(v ?? '').trim();
		if (!s) continue;
		payload[k] = s;
	}

	return new URLSearchParams(payload);
}

export type EnrollResult = {
	ok: boolean;
	flag?: string;
	msg?: string;
	/**
	 * Whether the failure is likely transient (worth retrying/polling).
	 * This is best-effort; the server may change semantics across term-system upgrades.
	 */
	retryable?: boolean;
};

export function parseEnrollResult(data: any): EnrollResult {
	const obj = data != null && typeof data === 'object' ? (data as any) : null;
	const flag = obj ? String(obj.flag ?? '').trim() : '';
	const code = obj ? String(obj.code ?? '').trim() : '';
	const okBool = obj ? Boolean(obj.ok) : false;
	const successBool = obj ? Boolean(obj.success) : false;
	const msg = obj
		? String(obj.msg ?? obj.message ?? obj.error ?? '').trim()
		: data != null
			? String(data).trim()
			: '';

	const primary = flag || code;
	// Ref: success flags include 1/3/6; -1 indicates capacity overflow (not selectable yet).
	if (okBool || successBool) return { ok: true, flag: flag || code || undefined, msg };
	if (primary === '1' || primary === '3' || primary === '6') return { ok: true, flag: primary, msg };
	if (primary === '-1') return { ok: false, flag: primary, msg, retryable: true };
	// Some variants only return a message string on success.
	if (msg && /成功|已选|选课成功|操作成功/.test(msg) && !/失败|错误|异常/.test(msg)) return { ok: true, flag: primary || undefined, msg };
	// Retryable heuristics (derived from ref UI scripts + field reports):
	// - 校验不通过/请刷新本网页后重试: context/token stale -> refresh and retry.
	// - 服务器繁忙: transient overload.
	// - 尚未到选课时间/系统维护: retry later (polling mode).
	const upper = msg.toUpperCase();
	const retryable =
		upper.includes('VALIDATION') ||
		upper.includes('BUSY') ||
		/校验不通过|刷新.*重试|服务器繁忙|系统繁忙|请稍后再试|尚未到|未到选课时间|系统维护|稍后开放/.test(msg);
	return { ok: false, flag: primary || undefined, msg: msg || undefined, retryable };
}

export type DropResult = {
	ok: boolean;
	code?: string;
	msg?: string;
	retryable?: boolean;
};

export function parseDropTuikBcResult(raw: unknown): DropResult {
	// Endpoint `/xsxk/zzxkyzb_tuikBcZzxkYzb.html` (ref) returns simple numeric/string codes.
	const code =
		typeof raw === 'number'
			? String(raw)
			: typeof raw === 'string'
				? raw.trim()
				: raw != null && typeof raw === 'object' && (raw as any).code != null
					? String((raw as any).code).trim()
					: raw != null
						? String(raw).trim()
						: '';
	if (code === '1') return { ok: true, code };
	if (code === '2') return { ok: false, code, msg: 'SERVER_BUSY', retryable: true };
	if (code === '3') return { ok: false, code, msg: 'UNKNOWN_ERROR', retryable: false };
	if (code === '4') return { ok: false, code, msg: 'ILLEGAL_ACCESS', retryable: false };
	if (code === '5') return { ok: false, code, msg: 'VALIDATION_FAILED', retryable: true };
	return { ok: false, code: code || undefined, msg: code || 'DROP_FAILED', retryable: false };
}
