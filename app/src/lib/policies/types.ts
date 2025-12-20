import type { FilterScope, CourseFiltersPolicy } from './filter/types';
import type { SolverPolicy } from './solver/types';
import type { EdgePolicy } from './edge/types';

/**
 * Top-level policy interface used by app code.
 *
 * Instance implementations live under `app/src/lib/policies/instances/<id>/...`.
 */
export type AppPolicy = {
	courseFilters: {
		getPolicy: (scope: FilterScope) => CourseFiltersPolicy;
	};
	solver: {
		getPolicy: () => SolverPolicy;
	};
	edge: {
		getPolicy: () => EdgePolicy;
	};
};
