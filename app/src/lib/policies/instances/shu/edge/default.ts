import type { EdgePolicy } from '../../../edge/types';
import { edgeOverflowSpeedRaceBlocksAuto } from './modules/overflowSpeedRaceBlocksAuto';
import { edgeFrozenBlocksNonJwxt } from './modules/frozenBlocksNonJwxt';
import { edgeDatasetFatalBlocksActions } from './modules/datasetFatalBlocksActions';
import { edgeHistoryIndexRange } from './modules/historyIndexRange';
import { edgeJwxtNeedsPullBlocksPush } from './modules/jwxtNeedsPullBlocksPush';
import { edgeJwxtEnrollMinBatch } from './modules/jwxtEnrollMinBatch';

export const shuEdgeDefaultPolicy: EdgePolicy = {
	validateActionAllowed: [
		edgeOverflowSpeedRaceBlocksAuto,
		edgeFrozenBlocksNonJwxt,
		edgeDatasetFatalBlocksActions,
		edgeHistoryIndexRange,
		edgeJwxtNeedsPullBlocksPush,
		edgeJwxtEnrollMinBatch
	]
};
