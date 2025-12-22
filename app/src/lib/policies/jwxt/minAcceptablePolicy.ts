import type { TermState } from '../../data/termState/types';
import { ENROLLMENT_BATCH_ORDER, type EnrollmentBatchLabel } from '../../../../shared/jwxtCrawler/batchPolicy';

/**
 * Interpret the "min acceptable batch" setting.
 *
 * UX rule:
 * - Selecting "其他已选人数" means "do not filter" (treat as disabled), because this row is a catch-all bucket
 *   and using it as a strict threshold is confusing for end users.
 */
export function getEffectiveMinAcceptableBatchLabel(state: TermState): EnrollmentBatchLabel | null {
	const min = (state.settings.jwxt.minAcceptableBatchLabel ?? null) as EnrollmentBatchLabel | null;
	if (!min) return null;
	if (min === OTHER_BATCH_LABEL) return null;
	return min;
}

export const OTHER_BATCH_LABEL = ENROLLMENT_BATCH_ORDER[ENROLLMENT_BATCH_ORDER.length - 1]!;
