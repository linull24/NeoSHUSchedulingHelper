import type { EdgePolicyModule } from '../../../../edge/types';

export const edgeJwxtNeedsPullBlocksPush: EdgePolicyModule = {
	id: 'edge:jwxt-needs-pull-blocks-push',
	apply: (state, action) => {
		const isPush = action.type === 'JWXT_PREVIEW_PUSH' || action.type === 'JWXT_CONFIRM_PUSH';
		if (!isPush) return null;
		if (state.jwxt.syncState === 'NEEDS_PULL') {
			return { ok: false, kind: 'jwxt-needs-pull', message: '需要先 Pull 远端状态' };
		}
		return { ok: true };
	}
};

