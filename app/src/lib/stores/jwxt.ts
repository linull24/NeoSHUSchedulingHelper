import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const USER_ID_KEY = 'jwxt.userId';
const AUTO_PUSH_MUTE_UNTIL_KEY = 'jwxt.autoPush.muteUntil';

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
export const jwxtAutoPushMuteUntil = writable(loadNumber(AUTO_PUSH_MUTE_UNTIL_KEY, 0));

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

jwxtAutoPushMuteUntil.subscribe((value) => {
	if (!browser) return;
	try {
		localStorage.setItem(AUTO_PUSH_MUTE_UNTIL_KEY, String(value));
	} catch {
		// ignore
	}
});
