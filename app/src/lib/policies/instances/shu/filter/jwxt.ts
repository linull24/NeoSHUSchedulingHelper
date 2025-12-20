import type { CourseFiltersPolicy } from '../../../filter/types';

/**
 * JWXT view scope: used by JWXT enrollment panels (online enroll/drop).
 *
 * Keep identical to `all` by default; future updates may want to surface additional limit-rules
 * relevant to JWXT-only actions.
 */
export const shuFilterJwxtDefault: CourseFiltersPolicy = {
	// JWXT enroll view is action-oriented. Default to hiding obviously non-actionable entries.
	abnormalLimitRuleKeys: ['capacityFull', 'selectionForbidden', 'locationClosed', 'classClosed'],
	selectionFiltersOverrides: {
		limitRules: {
			capacityFull: { defaultMode: 'exclude' }
		}
	}
};
