import type { Actionable } from './actionable';
import type { MetaDisplay } from './meta-display';

/**
 * List/log rows that share MetaDisplay + Actionable + empty-state wording.
 * Diagnostics/Constraint/ActionLog panels should conform.
 */
export interface FilterableLogRow extends MetaDisplay, Actionable {
	id: string;
	detail?: string;
	tags?: string[];
	kind?: string;
}

export interface FilterableLog {
	title?: string;
	subtitle?: string;
	emptyLabel?: string;
	items: FilterableLogRow[];
}
