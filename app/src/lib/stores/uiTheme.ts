import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getUIConfig, type ThemeId } from '../../config/ui';

if (browser) {
	await import('@material/web/all.js');
	await import('@fluentui/web-components');
}

const config = getUIConfig();
const storedTheme = browser ? (window.localStorage.getItem('ui-theme') as ThemeId | null) : null;
const isValidStoredTheme = storedTheme && config.themes.some((theme) => theme.id === storedTheme);
const initialTheme = (isValidStoredTheme ? storedTheme : config.currentTheme) ?? config.currentTheme;

export const availableThemes = config.themes;
export const currentTheme = writable<ThemeId>(initialTheme);

export function setTheme(themeId: ThemeId) {
	currentTheme.set(themeId);
}

if (browser) {
	currentTheme.subscribe((themeId) => {
		try {
			window.localStorage.setItem('ui-theme', themeId);
		} catch {
			// ignore storage failures (private browsing, quota, etc.)
		}
	});
}
