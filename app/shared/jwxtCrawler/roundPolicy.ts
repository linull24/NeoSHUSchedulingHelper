export type OverEnrollPolicy = 'unknown' | 'deny' | 'allow';

export type RoundPolicy = {
	xkkzId: string;
	overEnrollPolicy: OverEnrollPolicy;
	/**
	 * Raw selection-context flags surfaced for debugging and future refinement.
	 * Semantics are JWXT-specific and may change across term-system upgrades.
	 */
	rawFlags: {
		txbsfrl?: string;
		rlkz?: string;
		cdrlkz?: string;
		rlzlkz?: string;
		xkzgbj?: string;
		xkkzrlsrlmxsfs?: string;
		sxrlkzlx?: string;
	};
	/**
	 * TBD: finalize semantics using crawler/ref evidence + live observation.
	 * For now this is informational only and should not hard-block selection.
	 */
	note: 'TBD';
};

function pickStr(obj: Record<string, unknown> | null | undefined, key: string): string | undefined {
	const v = obj ? (obj as any)[key] : undefined;
	const s = String(v ?? '').trim();
	return s ? s : undefined;
}

export function deriveRoundPolicy(input: {
	context?: Record<string, unknown> | null;
	fields?: Record<string, unknown> | null;
	learnedOverEnrollPolicy?: OverEnrollPolicy;
}): RoundPolicy {
	const ctx = input.context ?? {};
	const fields = input.fields ?? {};
	const xkkzId = pickStr(ctx, 'xkkz_id') ?? pickStr(fields, 'xkkz_id') ?? '';
	const learned = input.learnedOverEnrollPolicy ?? 'unknown';
	return {
		xkkzId,
		overEnrollPolicy: learned,
		rawFlags: {
			txbsfrl: pickStr(ctx, 'txbsfrl') ?? pickStr(fields, 'txbsfrl'),
			rlkz: pickStr(ctx, 'rlkz') ?? pickStr(fields, 'rlkz'),
			cdrlkz: pickStr(ctx, 'cdrlkz') ?? pickStr(fields, 'cdrlkz'),
			rlzlkz: pickStr(ctx, 'rlzlkz') ?? pickStr(fields, 'rlzlkz'),
			xkzgbj: pickStr(ctx, 'xkzgbj') ?? pickStr(fields, 'xkzgbj'),
			xkkzrlsrlmxsfs: pickStr(ctx, 'xkkzrlsrlmxsfs') ?? pickStr(fields, 'xkkzrlsrlmxsfs'),
			sxrlkzlx: pickStr(ctx, 'sxrlkzlx') ?? pickStr(fields, 'sxrlkzlx')
		},
		note: 'TBD'
	};
}
