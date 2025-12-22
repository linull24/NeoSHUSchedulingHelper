import { courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import type { TermAction, TermState } from './types';
import { evaluateEdgeActionAllowed } from '../../policies/edge/runtime';

export type TermStateValidationError =
	| { kind: 'UNKNOWN_ENTRY_ID'; entryId: string }
	| { kind: 'DUPLICATE_SELECTED_GROUP'; groupKey: string; entryIds: string[] }
	| { kind: 'INVALID_ACTION'; message: string; gateKind?: string };

let cachedCampusSet: { datasetSig: string; campuses: Set<string> } | null = null;

function normalizeCampusForFilter(value: string) {
	const normalized = value.trim();
	if (!normalized) return '';
	if (normalized.includes('宝山主区') || normalized.includes('宝山东区')) return '宝山';
	return normalized;
}

function getCampusSetForDataset(datasetSig: string): Set<string> {
	if (cachedCampusSet?.datasetSig === datasetSig) return cachedCampusSet.campuses;
	const campusSet = new Set<string>();
	for (const entry of courseCatalogMap.values()) {
		const campus = (entry.campus ?? '').trim();
		if (campus) campusSet.add(normalizeCampusForFilter(campus));
	}
	cachedCampusSet = { datasetSig, campuses: campusSet };
	return campusSet;
}

export function validateActionAllowed(state: TermState, action: TermAction): TermStateValidationError | null {
	const gate = evaluateEdgeActionAllowed(state, action);
	if (!gate.ok) return { kind: 'INVALID_ACTION', message: gate.message, gateKind: gate.kind };

	return null;
}

export function validateStateInvariants(state: TermState): TermStateValidationError | null {
	if (state.history.cursor >= state.history.entries.length) {
		return { kind: 'INVALID_ACTION', message: 'history-cursor-out-of-range' };
	}
	for (const checkpoint of state.history.checkpoints) {
		if (checkpoint.atIndex >= state.history.entries.length) {
			return { kind: 'INVALID_ACTION', message: 'history-checkpoint-out-of-range' };
		}
	}

	for (const entryId of state.selection.selected) {
		if (!courseCatalogMap.has(entryId)) return { kind: 'UNKNOWN_ENTRY_ID', entryId };
	}
	for (const entryId of state.selection.wishlistSections) {
		if (!courseCatalogMap.has(entryId)) return { kind: 'UNKNOWN_ENTRY_ID', entryId };
	}

	const groupMap = new Map<string, string[]>();
	for (const entryId of state.selection.selected) {
		const entry = courseCatalogMap.get(entryId);
		if (!entry) continue;
		const key = deriveGroupKey(entry);
		const list = groupMap.get(key) ?? [];
		list.push(entryId);
		groupMap.set(key, list);
	}

	for (const [groupKey, entryIds] of groupMap.entries()) {
		if (entryIds.length > 1) {
			return { kind: 'DUPLICATE_SELECTED_GROUP', groupKey, entryIds };
		}
	}

	const homeCampusRaw = (state.settings.homeCampus ?? '').trim();
	if (!homeCampusRaw) {
		return { kind: 'INVALID_ACTION', message: 'settings-homeCampus-missing' };
	}
	const normalizedHomeCampus = normalizeCampusForFilter(homeCampusRaw);
	const campusSet = getCampusSetForDataset(state.dataset.sig);
	if (campusSet.size > 0 && !campusSet.has(normalizedHomeCampus)) {
		return { kind: 'INVALID_ACTION', message: 'settings-homeCampus-unknown' };
	}

	if (state.jwxt.syncState === 'FROZEN' && !state.jwxt.frozen) {
		return { kind: 'INVALID_ACTION', message: 'jwxt-frozen-missing' };
	}
	if (state.jwxt.syncState !== 'FROZEN' && state.jwxt.frozen) {
		return { kind: 'INVALID_ACTION', message: 'jwxt-frozen-unexpected' };
	}
	if (state.jwxt.syncState === 'LOCKED') {
		if (!state.jwxt.remoteSnapshot) return { kind: 'INVALID_ACTION', message: 'jwxt-locked-missing-remoteSnapshot' };
		if (!state.jwxt.baseline) return { kind: 'INVALID_ACTION', message: 'jwxt-locked-missing-baseline' };
	}
	if (state.jwxt.syncState === 'REMOTE_DIRTY' && !state.jwxt.remoteSnapshot) {
		return { kind: 'INVALID_ACTION', message: 'jwxt-remote-dirty-missing-remoteSnapshot' };
	}
	if (state.jwxt.syncState === 'NEEDS_PULL' && state.jwxt.pushTicket) {
		return { kind: 'INVALID_ACTION', message: 'jwxt-needs-pull-has-pushTicket' };
	}
	if (state.jwxt.pushTicket) {
		if (!state.jwxt.remoteSnapshot) return { kind: 'INVALID_ACTION', message: 'jwxt-pushTicket-missing-remoteSnapshot' };
		if (state.jwxt.pushTicket.datasetSig !== state.dataset.sig) {
			return { kind: 'INVALID_ACTION', message: 'jwxt-pushTicket-dataset-mismatch' };
		}
	}
	if (state.jwxt.baseline && state.jwxt.baseline.datasetSig !== state.dataset.sig) {
		return { kind: 'INVALID_ACTION', message: 'jwxt-baseline-dataset-mismatch' };
	}

	for (const constraint of state.solver.constraints.soft as any[]) {
		const weight = typeof constraint?.weight === 'number' ? constraint.weight : NaN;
		if (!Number.isFinite(weight) || weight <= 0) {
			return { kind: 'INVALID_ACTION', message: 'solver-soft-weight-invalid' };
		}
	}

	return null;
}
