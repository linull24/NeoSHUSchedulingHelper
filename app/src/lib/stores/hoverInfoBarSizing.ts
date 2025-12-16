import { get, writable } from 'svelte/store';

export const hoverInfoBarStickyMinHeight = writable(0);

export function rememberHoverInfoBarMinHeight(nextHeightPx: number) {
	if (!Number.isFinite(nextHeightPx)) return;
	if (nextHeightPx <= 0) return;

	const rounded = Math.round(nextHeightPx);
	const current = get(hoverInfoBarStickyMinHeight);
	if (rounded <= current + 1) return;

	hoverInfoBarStickyMinHeight.set(rounded);
}

