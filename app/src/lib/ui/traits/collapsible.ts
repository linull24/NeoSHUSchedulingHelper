/**
 * Collapsible/expandable state for grouped items (e.g., course groups with variants).
 */
export interface Collapsible {
	collapsed?: boolean;
	onToggle?: () => void;
	expandLabel?: string;
	collapseLabel?: string;
}
