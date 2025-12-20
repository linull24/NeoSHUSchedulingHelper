import { installDefaultJwxtPolicies } from '../../jwxt/defaultPolicies';
import type { JwxtPolicyRegistry } from '../../jwxt/registry';

export function installShuDefaultJwxtPolicies(registry: JwxtPolicyRegistry) {
	installDefaultJwxtPolicies(registry);
}

