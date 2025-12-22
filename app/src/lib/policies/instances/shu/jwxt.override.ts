import type { JwxtPolicy } from '../../jwxt/registry';

/**
 * Instance override for JWXT policy modules.
 *
 * - `remove`: unregister default policy IDs
 * - `add`: register extra policy modules
 */
export const shuJwxtPolicyOverride: {
	remove?: string[];
	add?: JwxtPolicy[];
} = {};

