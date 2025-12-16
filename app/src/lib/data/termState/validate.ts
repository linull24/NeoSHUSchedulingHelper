import { courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import type { TermAction, TermState } from './types';

export type TermStateValidationError =
	| { kind: 'UNKNOWN_ENTRY_ID'; entryId: string }
	| { kind: 'DUPLICATE_SELECTED_GROUP'; groupKey: string; entryIds: string[] }
	| { kind: 'FROZEN_BLOCKED'; message: string }
	| { kind: 'DATASET_FATAL_BLOCKED'; message: string }
	| { kind: 'NEEDS_PULL_BLOCKED'; message: string }
	| { kind: 'INVALID_ACTION'; message: string };

export function validateActionAllowed(state: TermState, action: TermAction): TermStateValidationError | null {
	if (state.jwxt.syncState === 'FROZEN') {
		if (!action.type.startsWith('JWXT_') && !action.type.startsWith('DATASET_')) {
			return { kind: 'FROZEN_BLOCKED', message: '冻结中：仅允许 JWXT / 数据集修复操作' };
		}
	}

	if (state.dataset.fatalResolve) {
		if (action.type.startsWith('DATASET_')) return null;
		if (action.type === 'HIST_TOGGLE_TO_INDEX') return null;
		if (action.type.startsWith('JWXT_')) return null;
		return { kind: 'DATASET_FATAL_BLOCKED', message: '数据集已变化：请先在线更新数据集或切换为班次模式' };
	}

	if (action.type === 'HIST_TOGGLE_TO_INDEX') {
		if (action.index < 0 || action.index > state.history.cursor) {
			return { kind: 'INVALID_ACTION', message: 'history-index-out-of-range' };
		}
	}

	if ((action.type === 'JWXT_PREVIEW_PUSH' || action.type === 'JWXT_CONFIRM_PUSH') && state.jwxt.syncState === 'NEEDS_PULL') {
		return { kind: 'NEEDS_PULL_BLOCKED', message: '需要先 Pull 远端状态' };
	}

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

	const selectedSet = new Set(state.selection.selected);
	for (const entryId of state.selection.wishlistSections) {
		if (selectedSet.has(entryId)) {
			return { kind: 'INVALID_ACTION', message: 'selection-overlap-selected-wishlist' };
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

	for (const constraint of state.solver.constraints.soft) {
		if (!Number.isFinite(constraint.weight) || constraint.weight <= 0) {
			return { kind: 'INVALID_ACTION', message: 'solver-soft-weight-invalid' };
		}
	}

	return null;
}
