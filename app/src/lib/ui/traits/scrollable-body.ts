/**
 * Contract to ensure only one scrollable body exists per panel (good for sticky headers/filters).
 * ListSurface implements this: header/filters are natural height; body takes remaining space with min-h-0 + overflow-auto.
 * When sticky is used, the scroll container must stay stable to avoid jump-on-toggle.
 */
export interface ScrollableBody {
	/** enable the main body scroll (vs. whole panel) */
	bodyScrollable?: boolean;
	/** scroll handler for infinite load etc., bound to the body container */
	onScroll?: (event: Event) => void;
}
