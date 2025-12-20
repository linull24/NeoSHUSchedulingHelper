import { getAppPolicy, installInstanceJwxtPolicies } from './runtime';
import { globalJwxtPolicyRegistry } from './jwxt';
export * from './types';
export * from './runtime';
export * from './filter/types';
export * from './solver/types';
export * from './edge/types';
export * from './edge/runtime';

/**
 * Side-effect import entry.
 *
 * Importing `$lib/policies` should be safe anywhere (SSG/dev/userscript), and it establishes a
 * single source of truth for:
 * - filter policy defaults
 * - solver entry gating policy hooks
 */
export const appPolicy = getAppPolicy();

// Install JWXT policy modules for the active instance.
installInstanceJwxtPolicies(globalJwxtPolicyRegistry);
