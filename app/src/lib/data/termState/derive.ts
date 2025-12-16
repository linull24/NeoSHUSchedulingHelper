import { courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import type { GroupKey, TermState } from './types';

export type GroupStatus = 'G0' | 'G1' | 'G2';
export type Availability = 'SELECTED' | 'OK_NO_RESCHEDULE' | 'OK_WITH_RESELECT' | 'IMPOSSIBLE';

export interface AvailabilityResult {
	availability: Availability;
	conflict: 'none' | 'time-conflict' | 'hard-conflict';
	blockerGroups: GroupKey[];
	allowed: boolean;
}

type CourseMetaLike = {
	conflict?: 'none' | 'time-conflict' | 'hard-conflict';
	conflictTargets?: string[];
	diagnostics?: Array<{ label: 'conflic' | 'impossible' | 'weak-impossible'; reason?: string }>;
};

function maxStatus(a: GroupStatus, b: GroupStatus): GroupStatus {
	if (a === 'G2' || b === 'G2') return 'G2';
	if (a === 'G1' || b === 'G1') return 'G1';
	return 'G0';
}

function entryIdToGroupKey(entryId: string): GroupKey | null {
	const entry = courseCatalogMap.get(entryId);
	if (!entry) return null;
	return deriveGroupKey(entry);
}

export function buildGroupStatusMap(state: TermState): Map<GroupKey, GroupStatus> {
	const map = new Map<GroupKey, GroupStatus>();

	const mark = (key: GroupKey | null, status: GroupStatus) => {
		if (!key) return;
		map.set(key, maxStatus(map.get(key) ?? 'G0', status));
	};

	for (const key of state.selection.wishlistGroups) mark(key, 'G1');
	for (const entryId of state.selection.wishlistSections) mark(entryIdToGroupKey(entryId), 'G1');
	for (const item of state.solver.staging) {
		if (item.kind === 'group') mark(item.key, 'G1');
		else mark(entryIdToGroupKey(item.key), 'G1');
	}
	for (const entryId of state.selection.selected) mark(entryIdToGroupKey(entryId), 'G2');

	return map;
}

export function deriveGroupStatus(state: TermState, groupKey: GroupKey): GroupStatus {
	return buildGroupStatusMap(state).get(groupKey) ?? 'G0';
}

export function isAvailabilityAllowedByPolicy(
	policy: TermState['settings']['courseListPolicy'],
	availability: Availability
) {
	if (availability === 'SELECTED') return false;
	if (policy === 'NO_CHECK') return true;
	if (policy === 'ONLY_OK_NO_RESCHEDULE') return availability === 'OK_NO_RESCHEDULE';
	if (policy === 'ALLOW_OK_WITH_RESELECT') return availability !== 'IMPOSSIBLE';
	if (policy === 'DIAGNOSTIC_SHOW_IMPOSSIBLE') return availability !== 'IMPOSSIBLE';
	return availability !== 'IMPOSSIBLE';
}

export function deriveAvailability(
	state: TermState,
	entryId: string,
	meta?: CourseMetaLike
): AvailabilityResult {
	const policy = state.settings.courseListPolicy;
	const scope = state.solver.changeScope;
	const entry = courseCatalogMap.get(entryId);
	const conflict = meta?.conflict ?? 'none';

	if (state.selection.selected.includes(entryId as any)) {
		return { availability: 'SELECTED', conflict, blockerGroups: [], allowed: false };
	}

	if (policy === 'NO_CHECK') {
		return {
			availability: 'OK_NO_RESCHEDULE',
			conflict,
			blockerGroups: [],
			allowed: true
		};
	}

	const blockers = new Set<GroupKey>();
	const pushBlocker = (key: GroupKey | null) => {
		if (!key) return;
		blockers.add(key);
	};

	for (const targetId of meta?.conflictTargets ?? []) {
		pushBlocker(entryIdToGroupKey(targetId));
	}

	const groupKey = entry ? deriveGroupKey(entry) : null;
	const hasSelectedInGroup =
		groupKey !== null &&
		state.selection.selected.some((id) => {
			const other = courseCatalogMap.get(id);
			return other ? deriveGroupKey(other) === groupKey : false;
		});
	if (hasSelectedInGroup) pushBlocker(groupKey);

	let availability: Availability = 'OK_NO_RESCHEDULE';
	if (hasSelectedInGroup) {
		availability = scope === 'FIX_SELECTED_SECTIONS' ? 'IMPOSSIBLE' : 'OK_WITH_RESELECT';
	}
	if (conflict === 'hard-conflict') {
		availability = 'IMPOSSIBLE';
	} else if (conflict === 'time-conflict') {
		if (availability !== 'IMPOSSIBLE') {
			availability = scope === 'FIX_SELECTED_SECTIONS' ? 'IMPOSSIBLE' : 'OK_WITH_RESELECT';
		}
	}

	return {
		availability,
		conflict,
		blockerGroups: Array.from(blockers).sort((a, b) => a.localeCompare(b)),
		allowed: isAvailabilityAllowedByPolicy(policy, availability)
	};
}
