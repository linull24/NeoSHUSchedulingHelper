import type { AvailabilityResult } from '$lib/data/termState/derive';
import type { TranslateFn } from '$lib/i18n';

export function getAvailabilityHint(result: AvailabilityResult, t: TranslateFn): string | null {
	if (result.availability === 'OK_NO_RESCHEDULE') return null;
	if (result.availability === 'SELECTED') return null;

	if (result.availability === 'OK_WITH_RESELECT') {
		return result.allowed
			? t('panels.common.availability.requiresReselect')
			: t('panels.common.availability.policyBlocksReselect');
	}

	if (result.availability === 'IMPOSSIBLE') {
		return t('panels.common.availability.impossible');
	}

	return null;
}

