export type ActionIntent = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ActionItem {
	id: string;
	label: string;
	intent?: ActionIntent;
	disabled?: boolean;
	tooltip?: string;
	onClick?: () => void;
}

/**
 * Describes components that expose a unified action area.
 * In Svelte, card/list implementations render via the "actions" slot + CardActionBar + AppButton.
 * Panel-level 按钮行直接用 AppControlRow + AppButton（如需背景自行扩展样式）。
 */
export interface Actionable {
	actions?: ActionItem[];
	actionsAlign?: 'start' | 'end';
}
