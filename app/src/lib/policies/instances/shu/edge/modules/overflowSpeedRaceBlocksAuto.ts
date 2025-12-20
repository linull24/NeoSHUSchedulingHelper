import type { EdgePolicyModule } from '../../../../edge/types';

export const edgeOverflowSpeedRaceBlocksAuto: EdgePolicyModule = {
	id: 'edge:overflow-speed-race-blocks-auto',
	apply: (state, action) => {
		if (state.settings.selectionMode !== 'overflowSpeedRaceMode') return null;

		const enablingAutoSolve = action.type === 'SETTINGS_UPDATE' && action.patch.autoSolveEnabled === true;
		const isAutoSolveStart =
			action.type === 'AUTO_SOLVE_RUN' ||
			action.type === 'AUTO_SOLVE_ENTRY_FILTER_APPLY' ||
			action.type === 'AUTO_SOLVE_APPLY';

		if (enablingAutoSolve || isAutoSolveStart) {
			return { ok: false, kind: 'disabled-speed-race', message: '先到先得模式下禁用自动模式。' };
		}
		return { ok: true };
	}
};

