export type TermDeriveResult = {
	termCode: string;
	xkxnm?: string;
	xkxqm?: string;
};

export type JwxtTermIndex = 1 | 2;

export type JwxtTermMapping = {
	/**
	 * Academic term index (human-friendly) -> JWXT `xkxqm` code.
	 * SHU commonly uses `1 -> 3` and `2 -> 16` (see `crawler/ref/A_Better_Schedule_for_SHU.py`).
	 */
	termIndexToXkxqm: Partial<Record<JwxtTermIndex, string>>;
};

export const DEFAULT_JWXT_TERM_MAPPING: JwxtTermMapping = {
	termIndexToXkxqm: {
		1: '3',
		2: '16'
	}
};

export function mapTermIndexToXkxqm(termIndex: JwxtTermIndex, mapping: JwxtTermMapping = DEFAULT_JWXT_TERM_MAPPING): string {
	const code = mapping.termIndexToXkxqm[termIndex];
	return String(code ?? '').trim();
}

export function deriveTermCode(fields: Record<string, unknown> | null | undefined): TermDeriveResult {
	const f = fields ?? {};
	const xkxnm = String((f as any).xkxnm ?? (f as any).xnm ?? '').trim();
	const xkxqm = String((f as any).xkxqm ?? (f as any).xqm ?? '').trim();
	const termCode = xkxnm && xkxqm ? `${xkxnm}-${xkxqm}` : xkxnm ? xkxnm : '';
	return { termCode, xkxnm: xkxnm || undefined, xkxqm: xkxqm || undefined };
}

export function normalizeRequestedTermId(requested: string): { kind: 'any' | 'termCode'; termCode?: string } {
	const raw = String(requested || '').trim();
	if (!raw) return { kind: 'any' };
	if (raw === 'latest') return { kind: 'any' };
	const prefix = raw.includes('--xkkz-') ? raw.split('--xkkz-')[0]! : raw;
	return prefix ? { kind: 'termCode', termCode: prefix.trim() } : { kind: 'any' };
}

export function termMatches(requestedTermId: string | undefined, derivedTermCode: string): boolean {
	if (!requestedTermId) return true;
	const norm = normalizeRequestedTermId(requestedTermId);
	if (norm.kind === 'any') return true;
	if (!derivedTermCode) return true;
	return norm.termCode === derivedTermCode.trim();
}
