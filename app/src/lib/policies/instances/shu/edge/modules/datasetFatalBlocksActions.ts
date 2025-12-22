import type { EdgePolicyModule } from '../../../../edge/types';

export const edgeDatasetFatalBlocksActions: EdgePolicyModule = {
	id: 'edge:dataset-fatal-blocks-actions',
	apply: (state, action) => {
		if (!state.dataset.fatalResolve) return null;

		if (action.type.startsWith('DATASET_')) return { ok: true };
		if (action.type === 'HIST_TOGGLE_TO_INDEX') return { ok: true };
		if (action.type.startsWith('JWXT_')) return { ok: true };

		const solverSafe =
			action.type === 'SOLVER_ADD_LOCK' ||
			action.type === 'SOLVER_REMOVE_LOCK' ||
			action.type === 'SOLVER_REMOVE_LOCK_MANY' ||
			action.type === 'SOLVER_UPDATE_LOCK' ||
			action.type === 'SOLVER_ADD_SOFT' ||
			action.type === 'SOLVER_REMOVE_SOFT' ||
			action.type === 'SOLVER_REMOVE_SOFT_MANY' ||
			action.type === 'SOLVER_UPDATE_SOFT' ||
			action.type === 'SOLVER_STAGING_ADD' ||
			action.type === 'SOLVER_STAGING_ADD_MANY' ||
			action.type === 'SOLVER_STAGING_REMOVE' ||
			action.type === 'SOLVER_STAGING_CLEAR';
		if (solverSafe) return { ok: true };

		return { ok: false, kind: 'dataset-fatal-blocked', message: '数据集已变化：请先在线更新数据集或切换为班次模式' };
	}
};

