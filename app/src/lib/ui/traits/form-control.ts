/**
 * Base form control contract used by AppField/AppControlRow/AppControlPanel.
 * Keeps label/description/required/feedback in one place for FE/BE alignment.
 */
export interface FormControlTrait {
	label?: string;
	description?: string;
	required?: boolean;
	placeholder?: string;
	disabled?: boolean;
}
