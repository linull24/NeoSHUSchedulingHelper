import type { EdgePolicyModule } from '../../../../edge/types';

export const edgeHistoryIndexRange: EdgePolicyModule = {
	id: 'edge:history-index-range',
	apply: (state, action) => {
		if (action.type !== 'HIST_TOGGLE_TO_INDEX') return null;
		if (action.index < 0 || action.index > state.history.cursor) {
			return { ok: false, kind: 'history-index-out-of-range', message: 'history-index-out-of-range' };
		}
		return { ok: true };
	}
};

