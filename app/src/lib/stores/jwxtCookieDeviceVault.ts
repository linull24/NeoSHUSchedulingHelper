import { browser } from '$app/environment';
import { base } from '$app/paths';
import { decryptDeviceVaultText, encryptDeviceVaultText, isDeviceVaultPayload } from '../utils/cryptoDeviceVault';
import { idbKvDelete, idbKvGet, idbKvPut } from '../utils/idbKv';

const LEGACY_LOCALSTORAGE_KEY = 'jwxt.cookieDeviceVault.v1';
const PRESENT_COOKIE = 'jwxt_cookie_device_vault_present_v1';
const PRESENT_LS_KEY = 'jwxt.cookieDeviceVault.present.v1';

const IDB = {
	dbName: 'shu-course-scheduler.jwxtCookieDeviceVaultPayload.v1',
	storeName: 'payload'
} as const;
const IDB_KEY: IDBValidKey = 'jwxt-cookie';

function readCookie(name: string): string | null {
	if (!browser) return null;
	const source = document.cookie || '';
	const parts = source.split(';');
	let found: string | null = null;
	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf('=');
		const key = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim();
		if (key !== name) continue;
		found = eq >= 0 ? decodeURIComponent(trimmed.slice(eq + 1)) : '';
	}
	return found;
}

function writeCookie(name: string, value: string, maxAgeDays: number) {
	if (!browser) return;
	const maxAge = Math.max(1, Math.floor(maxAgeDays)) * 24 * 60 * 60;
	const attrsBase = [`Max-Age=${maxAge}`, `SameSite=Lax`];
	if (typeof location !== 'undefined' && location.protocol === 'https:') attrsBase.push('Secure');

	const desiredPath = base && base !== '/' ? base : '/';
	const primary = `${name}=${encodeURIComponent(value)}; ${attrsBase.join('; ')}; Path=${desiredPath}`;
	document.cookie = primary;
	if (readCookie(name) !== value && desiredPath !== '/') {
		const fallback = `${name}=${encodeURIComponent(value)}; ${attrsBase.join('; ')}; Path=/`;
		document.cookie = fallback;
	}
}

function clearCookie(name: string) {
	if (!browser) return;
	const attrsBase = [`Max-Age=0`, `SameSite=Lax`];
	if (typeof location !== 'undefined' && location.protocol === 'https:') attrsBase.push('Secure');
	const desiredPath = base && base !== '/' ? base : '/';
	document.cookie = `${name}=; ${attrsBase.join('; ')}; Path=${desiredPath}`;
	if (desiredPath !== '/') document.cookie = `${name}=; ${attrsBase.join('; ')}; Path=/`;
}

export function hasStoredJwxtCookieDeviceVault(): boolean {
	if (!browser) return false;
	if (readCookie(PRESENT_COOKIE) === '1') return true;
	try {
		if (localStorage.getItem(PRESENT_LS_KEY) === '1') return true;
		return Boolean(localStorage.getItem(LEGACY_LOCALSTORAGE_KEY));
	} catch {
		return false;
	}
}

export async function saveJwxtCookieToDeviceVault(cookieHeader: string) {
	if (!browser) throw new Error('Device vault only available in browser');
	const payload = await encryptDeviceVaultText(cookieHeader);
	await idbKvPut(IDB, IDB_KEY, payload);
	writeCookie(PRESENT_COOKIE, '1', 365);
	try {
		localStorage.setItem(PRESENT_LS_KEY, '1');
	} catch {
		// ignore
	}
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
}

export async function loadJwxtCookieFromDeviceVault(): Promise<string> {
	if (!browser) throw new Error('Device vault only available in browser');
	const current = await idbKvGet<unknown>(IDB, IDB_KEY);
	if (current && isDeviceVaultPayload(current)) {
		writeCookie(PRESENT_COOKIE, '1', 365);
		try {
			localStorage.setItem(PRESENT_LS_KEY, '1');
		} catch {
			// ignore
		}
		return decryptDeviceVaultText(current);
	}

	// Legacy fallback: migrate from localStorage.
	let raw = '';
	try {
		raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY) ?? '';
	} catch {
		raw = '';
	}
	if (!raw) throw new Error('NO_VAULT');
	const parsed = JSON.parse(raw) as unknown;
	if (!isDeviceVaultPayload(parsed)) throw new Error('INVALID_VAULT');
	await idbKvPut(IDB, IDB_KEY, parsed);
	writeCookie(PRESENT_COOKIE, '1', 365);
	try {
		localStorage.setItem(PRESENT_LS_KEY, '1');
	} catch {
		// ignore
	}
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
	return decryptDeviceVaultText(parsed);
}

export function clearJwxtCookieDeviceVault() {
	if (!browser) return;
	void idbKvDelete(IDB, IDB_KEY);
	clearCookie(PRESENT_COOKIE);
	try {
		localStorage.removeItem(PRESENT_LS_KEY);
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
}

export async function rehydrateJwxtCookieDeviceVaultPresenceMarker() {
	if (!browser) return;
	try {
		if (readCookie(PRESENT_COOKIE) === '1') return;
		if (localStorage.getItem(PRESENT_LS_KEY) === '1') return;
	} catch {
		// ignore
	}
	try {
		const payload = await idbKvGet<unknown>(IDB, IDB_KEY);
		if (payload && isDeviceVaultPayload(payload)) {
			writeCookie(PRESENT_COOKIE, '1', 365);
			try {
				localStorage.setItem(PRESENT_LS_KEY, '1');
			} catch {
				// ignore
			}
		}
	} catch {
		// ignore
	}
}
