import type { EdgePolicyModule } from '../../../../edge/types';

export const edgeFrozenBlocksNonJwxt: EdgePolicyModule = {
	id: 'edge:frozen-blocks-non-jwxt',
	apply: (state, action) => {
		if (state.jwxt.syncState !== 'FROZEN') return null;

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
		if (!solverSafe && !action.type.startsWith('JWXT_') && !action.type.startsWith('DATASET_')) {
			return { ok: false, kind: 'frozen-blocked', message: '冻结中：仅允许 JWXT / 数据集修复操作' };
		}
		return { ok: true };
	}
};

