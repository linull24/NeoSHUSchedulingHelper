import type { EdgePolicyModule } from '../../../edge/types';

export const shuEdgeOverride: Partial<{
	validateActionAllowed: { remove?: string[]; add?: EdgePolicyModule[] };
}> = {};

