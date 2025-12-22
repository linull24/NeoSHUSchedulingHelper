import { get, writable } from 'svelte/store';
import { currentTheme, availableThemes, setTheme } from '../stores/uiTheme';
import { materialSeedColor, setMaterialSeedColor } from '../stores/materialThemeColor';
import { fluentAccentColor, setFluentAccentColor } from '../stores/fluentThemeColor';
import { collapseCoursesByName, hideFilterStatusControl } from '../stores/courseDisplaySettings';
import { minAcceptableBatchLabel, setMinAcceptableBatchLabel } from '../stores/batchPolicySettings';
import { OTHER_BATCH_LABEL } from '../policies/jwxt/minAcceptablePolicy';
import {
	crossCampusAllowed,
	homeCampus,
	setCrossCampusAllowed,
	setHomeCampus,
	selectionMode,
	setSelectionMode
} from '../stores/coursePreferences';
import type { SelectionMode } from '../stores/coursePreferences';
import {
	paginationMode,
	pageSize,
	pageNeighbors,
	showWeekends,
	setPaginationMode as setPaginationModeValue,
	setPageSize as setPageSizeValue,
	setPageNeighbors as setPageNeighborsValue,
	toggleWeekends as toggleWeekendsValue
} from '../stores/paginationSettings';
import { getMetaConfig } from '../../config/meta';

const initialTheme = get(currentTheme);
type ThemeId = typeof initialTheme;

export const metaConfig = getMetaConfig();
export const selectedTheme = writable<ThemeId>(initialTheme);
export {
	availableThemes,
	collapseCoursesByName,
	hideFilterStatusControl,
	crossCampusAllowed,
	homeCampus,
	selectionMode,
	minAcceptableBatchLabel,
	paginationMode,
	pageSize,
	pageNeighbors,
	showWeekends
};
export { materialSeedColor };
export { fluentAccentColor };

export function handleThemeChange(event: Event) {
	const target = event.target as HTMLSelectElement;
	const value = target.value as ThemeId;
	selectedTheme.set(value);
	setTheme(value);
}

export function handleMaterialSeedColorChange(event: Event) {
	const target = event.target as HTMLInputElement;
	setMaterialSeedColor(target.value);
}

export function setMaterialSeedColorValue(value: string) {
	setMaterialSeedColor(value);
}

export function handleFluentAccentColorChange(event: Event) {
	const target = event.target as HTMLInputElement;
	setFluentAccentColor(target.value);
}

export function setFluentAccentColorValue(value: string) {
	setFluentAccentColor(value);
}

export function toggleCollapseSetting() {
	collapseCoursesByName.update(value => !value);
}

export function toggleHideFilterStatusControl() {
	hideFilterStatusControl.update((value) => !value);
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

export function setHomeCampusSetting(value: string) {
	setHomeCampus(value);
}

export function setMinAcceptableBatchSetting(value: any) {
	const raw = typeof value === 'string' ? value.trim() : '';
	const next = raw && raw !== OTHER_BATCH_LABEL ? (raw as any) : null;
	void setMinAcceptableBatchLabel(next);
}

export function setPaginationMode(mode: 'paged' | 'continuous') {
	setPaginationModeValue(mode);
}

export function setPageSize(value: number) {
	setPageSizeValue(value);
}

export function setPageNeighbors(value: number) {
	setPageNeighborsValue(value);
}

export function toggleWeekends() {
	toggleWeekendsValue();
}
