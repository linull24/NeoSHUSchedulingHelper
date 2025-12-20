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
		rwlx: pickStr(ctx, 'rwlx'),
		rlkz: pickStr(ctx, 'rlkz'),
		cdrlkz: pickStr(ctx, 'cdrlkz'),
		rlzlkz: pickStr(ctx, 'rlzlkz'),
		sxbj: deriveSxbj({ rlkz: pickStr(ctx, 'rlkz'), cdrlkz: pickStr(ctx, 'cdrlkz'), rlzlkz: pickStr(ctx, 'rlzlkz') }),
		xxkbj: extras.xxkbj ?? '0',
		qz: extras.qz ?? '0',
		cxbj: extras.cxbj ?? '0',
		xkkz_id: pickStr(ctx, 'xkkz_id'),
		kklxdm: pickStr(ctx, 'kklxdm'),
		njdm_id: pickStr(ctx, 'njdm_id'),
		zyh_id: pickStr(ctx, 'zyh_id'),
		xklc: pickStr(ctx, 'xklc'),
		xkxnm: pickStr(ctx, 'xkxnm'),
		xkxqm: pickStr(ctx, 'xkxqm'),
		jcxx_id: extras.jcxx_id ?? ''
	};

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
	const flag = data != null ? String((data as any).flag ?? '').trim() : '';
	const msg = data != null ? String((data as any).msg ?? '').trim() : '';
	// Ref: success flags include 1/3/6; -1 indicates capacity overflow (not selectable yet).
	if (flag === '1' || flag === '3' || flag === '6') return { ok: true, flag, msg };
	if (flag === '-1') return { ok: false, flag, msg, retryable: true };
	// Other failure flags are generally stable (constraints/duplicate/conflict); treat as non-retryable by default.
	return { ok: false, flag: flag || undefined, msg: msg || undefined, retryable: false };
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
