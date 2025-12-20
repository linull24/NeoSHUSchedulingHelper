import type { TermState } from '$lib/data/termState/types';
import type { EnrollmentBatchLabel } from '../../../../shared/jwxtCrawler/batchPolicy';

export type BatchScope = 'all' | 'current';

export function resolveMinAcceptableBatchLabelForScope(
	state: TermState,
	scope: BatchScope
): EnrollmentBatchLabel | null {
	const overrides = (state.settings.jwxt as any).minAcceptableBatchLabelOverrides ?? {};
	if (Object.prototype.hasOwnProperty.call(overrides, scope)) {
		return (overrides as any)[scope] ?? null;
	}
	return state.settings.jwxt.minAcceptableBatchLabel ?? null;
}

export function setMinAcceptableBatchLabelOverride(
	state: TermState,
	scope: BatchScope,
	next: EnrollmentBatchLabel | null | 'inherit'
): Partial<TermState['settings']> {
	const base = (state.settings.jwxt as any).minAcceptableBatchLabelOverrides ?? {};
	const overrides: any = { ...base };
	if (next === 'inherit') {
		delete overrides[scope];
	} else {
		overrides[scope] = next;
	}
	return { jwxt: { ...(state.settings.jwxt as any), minAcceptableBatchLabelOverrides: overrides } as any };
}

