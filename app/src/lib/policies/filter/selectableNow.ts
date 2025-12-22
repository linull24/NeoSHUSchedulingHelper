import type { CourseCatalogEntry } from '../../data/catalog/courseCatalog';
import type { TermState } from '../../data/termState/types';
import { isAvailabilityAllowedByPolicy } from '../courseList/availability';
import { getJwxtEnrollButtonPolicyState } from '../jwxt/ui';

export type SelectableNowMeta = {
	conflict?: 'none' | 'time-conflict' | 'hard-conflict';
};

export function isLocalSelectableNow(args: {
	meta: SelectableNowMeta;
	courseListPolicy: TermState['settings']['courseListPolicy'];
	changeScope: 'FIX_SELECTED_SECTIONS' | 'RESELECT_WITHIN_SELECTED_GROUPS' | 'REPLAN_ALL' | null;
	hasSelectedInGroup: boolean;
}) {
	const scope = args.changeScope ?? null;
	let availability: 'OK_NO_RESCHEDULE' | 'OK_WITH_RESELECT' | 'IMPOSSIBLE' = 'OK_NO_RESCHEDULE';
	if (args.hasSelectedInGroup) {
		availability = scope === 'FIX_SELECTED_SECTIONS' ? 'IMPOSSIBLE' : 'OK_WITH_RESELECT';
	}
	if (args.meta.conflict === 'hard-conflict') {
		availability = 'IMPOSSIBLE';
	} else if (args.meta.conflict === 'time-conflict') {
		if (availability !== 'IMPOSSIBLE') {
			availability = scope === 'FIX_SELECTED_SECTIONS' ? 'IMPOSSIBLE' : 'OK_WITH_RESELECT';
		}
	}

	return isAvailabilityAllowedByPolicy(args.courseListPolicy, availability as any);
}

export function isJwxtSelectableNow(args: {
	state: TermState;
	course: CourseCatalogEntry;
	meta: SelectableNowMeta;
	remoteSelectedKeySet: Set<string>;
}) {
	const courseCode = args.course.courseCode ?? null;
	const sectionId = args.course.sectionId ?? null;
	if (!courseCode || !sectionId) return false;
	if (args.meta.conflict === 'time-conflict') return false;
	if (args.remoteSelectedKeySet.has(`${courseCode}::${sectionId}`)) return false;
	const policyState = getJwxtEnrollButtonPolicyState(args.state, { kchId: courseCode, jxbId: sectionId });
	return policyState.enabled;
}
