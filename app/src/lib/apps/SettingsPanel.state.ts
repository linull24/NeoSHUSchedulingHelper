import { get, writable } from 'svelte/store';
import { currentTheme, availableThemes, setTheme } from '../stores/uiTheme';
import { collapseCoursesByName } from '../stores/courseDisplaySettings';
import { crossCampusAllowed, setCrossCampusAllowed, selectionMode, setSelectionMode } from '../stores/coursePreferences';
import type { SelectionMode } from '../stores/coursePreferences';
import { paginationMode, pageSize, pageNeighbors, showWeekends } from '../stores/paginationSettings';

const initialTheme = get(currentTheme);
type ThemeId = typeof initialTheme;

export const selectedTheme = writable<ThemeId>(initialTheme);
export { availableThemes, collapseCoursesByName, crossCampusAllowed, selectionMode, paginationMode, pageSize, pageNeighbors, showWeekends };

export function handleThemeChange(event: Event) {
	const target = event.target as HTMLSelectElement;
	const value = target.value as ThemeId;
	selectedTheme.set(value);
	setTheme(value);
}

export function toggleCollapseSetting() {
	collapseCoursesByName.update(value => !value);
}

export function toggleCrossCampus() {
	crossCampusAllowed.update((value) => {
		const next = !value;
		setCrossCampusAllowed(next);
		return next;
	});
}

export function setSelectionModeSetting(mode: SelectionMode) {
	setSelectionMode(mode);
}

export function setPaginationMode(mode: 'paged' | 'continuous') {
	paginationMode.set(mode);
}

export function setPageSize(value: number) {
	if (!Number.isFinite(value) || value <= 0) return;
	pageSize.set(Math.floor(value));
}

export function setPageNeighbors(value: number) {
	if (!Number.isFinite(value) || value < 1) return;
	pageNeighbors.set(Math.floor(value));
}

export function toggleWeekends() {
	showWeekends.update((v) => !v);
}
