import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { resolveTermId } from '../../config/term';

export type SelectionMode = 'allowOverflowMode' | 'overflowSpeedRaceMode';

const termId = resolveTermId();
const CROSS_KEY = 'course-cross-campus-enabled';
const MODE_KEY = `selection-mode:${termId}`;
const DEFAULT_SELECTION_MODE: SelectionMode = 'allowOverflowMode';

function normalizeSelectionMode(value: string | null): SelectionMode | null {
	if (!value) return null;
	if (value === 'allowOverflowMode' || value === 'overbook') return 'allowOverflowMode';
	if (value === 'overflowSpeedRaceMode' || value === 'speed') return 'overflowSpeedRaceMode';
	return null;
}

function loadCrossCampus(): boolean {
	if (!browser) return false;
	const value = localStorage.getItem(CROSS_KEY);
	return value === 'true';
}

function loadSelectionMode(): { mode: SelectionMode; known: boolean } {
	if (!browser) return { mode: DEFAULT_SELECTION_MODE, known: false };
	const stored = normalizeSelectionMode(localStorage.getItem(MODE_KEY));
	if (!stored) return { mode: DEFAULT_SELECTION_MODE, known: false };
	return { mode: stored, known: true };
}

const crossCampusInitial = loadCrossCampus();
export const crossCampusAllowed = writable<boolean>(crossCampusInitial);

const selectionInitial = loadSelectionMode();
export const selectionMode = writable<SelectionMode>(selectionInitial.mode);
export const selectionModeKnown = writable<boolean>(selectionInitial.known);

export const selectionModeNeedsPrompt = derived(selectionModeKnown, (known) => !known);

export function setCrossCampusAllowed(value: boolean) {
	crossCampusAllowed.set(value);
	if (browser) {
		localStorage.setItem(CROSS_KEY, String(value));
	}
}

export function setSelectionMode(mode: SelectionMode) {
	selectionMode.set(mode);
	selectionModeKnown.set(true);
	if (browser) {
		localStorage.setItem(MODE_KEY, mode);
	}
}
