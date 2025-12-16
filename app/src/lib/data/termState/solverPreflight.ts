import type { DesiredLock, SoftConstraint } from '../desired/types';
import type { TermState } from './types';

export type SolverInvalidIssue =
	| { domain: 'lock'; id: string; code: LockIssueCode }
	| { domain: 'soft'; id: string; code: SoftIssueCode };

export type LockIssueCode =
	| 'lock.courseHashMissing'
	| 'lock.sectionIdMissing'
	| 'lock.teacherIdMissing'
	| 'lock.timeWindowMissing'
	| 'lock.timeWindowRange'
	| 'lock.groupEmpty';

export type SoftIssueCode = 'soft.weightInvalid' | 'soft.campusMissing';

export function collectSolverRunIssues(state: TermState): SolverInvalidIssue[] {
	const issues: SolverInvalidIssue[] = [];

	for (const lock of state.solver.constraints.locks as unknown as DesiredLock[]) {
		switch (lock.type) {
			case 'course':
				if (!lock.courseHash) issues.push({ domain: 'lock', id: lock.id, code: 'lock.courseHashMissing' });
				break;
			case 'section':
				if (!lock.sectionId) issues.push({ domain: 'lock', id: lock.id, code: 'lock.sectionIdMissing' });
				break;
			case 'teacher':
				if (!lock.teacherId) issues.push({ domain: 'lock', id: lock.id, code: 'lock.teacherIdMissing' });
				break;
			case 'time': {
				const window = lock.timeWindow;
				if (!window || window.day == null || window.startPeriod == null || window.endPeriod == null) {
					issues.push({ domain: 'lock', id: lock.id, code: 'lock.timeWindowMissing' });
					break;
				}
				if (window.startPeriod >= window.endPeriod) {
					issues.push({ domain: 'lock', id: lock.id, code: 'lock.timeWindowRange' });
				}
				break;
			}
			case 'group': {
				const group = lock.group;
				if (!group?.courseHashes?.length) issues.push({ domain: 'lock', id: lock.id, code: 'lock.groupEmpty' });
				break;
			}
			default:
				break;
		}
	}

	for (const constraint of state.solver.constraints.soft as unknown as SoftConstraint[]) {
		if (!Number.isFinite(constraint.weight) || constraint.weight <= 0) {
			issues.push({ domain: 'soft', id: constraint.id, code: 'soft.weightInvalid' });
			continue;
		}
		if (constraint.type === 'avoid-campus') {
			const campus = constraint.params?.campus;
			if (typeof campus !== 'string' || !campus) {
				issues.push({ domain: 'soft', id: constraint.id, code: 'soft.campusMissing' });
			}
		}
	}

	return issues.sort((a, b) => (a.domain + a.id).localeCompare(b.domain + b.id));
}

