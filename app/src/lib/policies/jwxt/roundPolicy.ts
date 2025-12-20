import type { TermState } from '../../data/termState/types';
import type { OverEnrollPolicy } from '../../../../shared/jwxtCrawler/roundPolicy';

export type SelectionMode = TermState['settings']['selectionMode'];

/**
 * Map selection mode to round's over-enroll policy.
 *
 * This is policy-level logic: avoid scattering this mapping across UI/solver/JWXT flows.
 */
export function selectionModeToOverEnrollPolicy(mode: SelectionMode | undefined): OverEnrollPolicy {
	switch (mode) {
		case 'allowOverflowMode':
			return 'allow';
		case 'overflowSpeedRaceMode':
			return 'deny';
		default:
			return 'unknown';
	}
}

/**
 * Infer default selection mode from round index (xklc).
 *
 * NOTE: This is a heuristic used for UX defaults only; actual mode is always user-controlled.
 */
export function inferDefaultSelectionModeFromRoundIndex(xklc: string | undefined): SelectionMode {
	const round = String(xklc ?? '').trim();
	if (round === '1') return 'allowOverflowMode';
	if (round === '2') return 'overflowSpeedRaceMode';
	return null;
}
