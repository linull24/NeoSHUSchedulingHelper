import { derived } from 'svelte/store';
import { dispatchTermAction, termState } from './termStateStore';
import type { EnrollmentBatchLabel } from '../../../shared/jwxtCrawler/batchPolicy';

export const minAcceptableBatchLabel = derived(termState, ($state) => ($state?.settings.jwxt.minAcceptableBatchLabel ?? null) as EnrollmentBatchLabel | null);

export async function setMinAcceptableBatchLabel(label: EnrollmentBatchLabel | null) {
	const patch = { jwxt: { minAcceptableBatchLabel: label } } as any;
	await dispatchTermAction({ type: 'SETTINGS_UPDATE', patch });
}

