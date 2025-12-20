import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const DONE_LS_KEY = 'setupWizard.v1.done';
const DONE_COOKIE_KEY = 'setup_wizard_done_v1';
const MAX_COOKIE_AGE = 365 * 24 * 60 * 60; // 1 year

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCookie(): string | null {
	if (typeof document === 'undefined') return null;
	const pattern = `(?:^|; )${escapeRegExp(DONE_COOKIE_KEY)}=([^;]*)`;
	const match = document.cookie.match(new RegExp(pattern));
	return match ? decodeURIComponent(match[1] ?? '') : null;
}

function writeCookie(value: string | null) {
	if (typeof document === 'undefined') return;
	const attrs = [`Path=/`, `SameSite=Lax`];
	if (typeof location !== 'undefined' && location.protocol === 'https:') attrs.push('Secure');

	const now = Date.now();
	const expiresAt = new Date(now + MAX_COOKIE_AGE * 1000).toUTCString();

	function trySet(cookie: string) {
		document.cookie = cookie;
		return readCookie() !== null;
	}

	if (value === null) {
		const expired = 'Thu, 01 Jan 1970 00:00:00 GMT';
		document.cookie = `${DONE_COOKIE_KEY}=; Max-Age=0; Expires=${expired}; ${attrs.join('; ')}`;
		return;
	}

	const encoded = encodeURIComponent(value);
	const primary = `${DONE_COOKIE_KEY}=${encoded}; Max-Age=${MAX_COOKIE_AGE}; Expires=${expiresAt}; ${attrs.join('; ')}`;
	if (trySet(primary)) return;

	// Fallback for environments that reject some attributes but still allow host-only cookies.
	const minimal = `${DONE_COOKIE_KEY}=${encoded}; Max-Age=${MAX_COOKIE_AGE}; Path=/`;
	trySet(minimal);
}

function loadDone(): boolean {
	if (!browser) return false;
	try {
		const value = localStorage.getItem(DONE_LS_KEY);
		if (value === 'true') return true;
	} catch {
		// ignore
	}
	try {
		const cookie = readCookie();
		return cookie === '1' || cookie === 'true';
	} catch {
		return false;
	}
}

export const setupWizardDone = writable(loadDone());

setupWizardDone.subscribe((value) => {
	if (!browser) return;
	try {
		if (value) localStorage.setItem(DONE_LS_KEY, 'true');
		else localStorage.removeItem(DONE_LS_KEY);
	} catch {
		// ignore
	}
	try {
		writeCookie(value ? '1' : null);
	} catch {
		// ignore
	}
});
