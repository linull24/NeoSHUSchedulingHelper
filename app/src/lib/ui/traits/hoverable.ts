/**
 * Hover capability contract for cards/list rows.
 * Example: CourseCard enables hover for sections, disables for multi-section groups.
 */
export interface Hoverable {
	hoverable?: boolean;
	onHover?: () => void;
	onLeave?: () => void;
}
