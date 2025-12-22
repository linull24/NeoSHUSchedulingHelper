import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const USER_ID_KEY = 'jwxt.userId';

function loadString(key: string, fallback: string): string {
	if (!browser) return fallback;
	try {
		return localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
}

function loadNumber(key: string, fallback: number): number {
	if (!browser) return fallback;
	try {
		const raw = Number(localStorage.getItem(key));
		return Number.isFinite(raw) && raw > 0 ? raw : fallback;
	} catch {
		return fallback;
	}
}

export const jwxtRememberedUserId = writable(loadString(USER_ID_KEY, ''));

jwxtRememberedUserId.subscribe((value) => {
	if (!browser) return;
	try {
		if (value) {
			localStorage.setItem(USER_ID_KEY, value);
		} else {
			localStorage.removeItem(USER_ID_KEY);
		}
	} catch {
		// ignore
	}
});
