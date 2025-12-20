import { browser } from '$app/environment';
import { decryptVaultText, encryptVaultText, isVaultPayload } from '../utils/cryptoVault';
import { idbKvDelete, idbKvGet, idbKvPut } from '../utils/idbKv';

const LEGACY_LOCALSTORAGE_KEY = 'jwxt.cookieVault.v1';
const PRESENT_COOKIE = 'jwxt_cookie_password_vault_present_v1';

const IDB = {
	dbName: 'shu-course-scheduler.jwxtCookieVaultPayload.v1',
	storeName: 'payload'
} as const;
const IDB_KEY: IDBValidKey = 'jwxt-cookie';

function readCookie(name: string): string | null {
	if (!browser) return null;
	const source = document.cookie || '';
	const parts = source.split(';');
	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf('=');
		const key = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim();
		if (key !== name) continue;
		return eq >= 0 ? decodeURIComponent(trimmed.slice(eq + 1)) : '';
	}
	return null;
}

function writeCookie(name: string, value: string, maxAgeDays: number) {
	if (!browser) return;
	const maxAge = Math.max(1, Math.floor(maxAgeDays)) * 24 * 60 * 60;
	document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
	if (!browser) return;
	document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function hasStoredJwxtCookieVault(): boolean {
	if (!browser) return false;
	if (readCookie(PRESENT_COOKIE) === '1') return true;
	try {
		return Boolean(localStorage.getItem(LEGACY_LOCALSTORAGE_KEY));
	} catch {
		return false;
	}
}

export async function saveJwxtCookieToVault(cookieHeader: string, vaultPassword: string) {
	if (!browser) throw new Error('Vault only available in browser');
	const payload = await encryptVaultText(cookieHeader, vaultPassword);
	await idbKvPut(IDB, IDB_KEY, payload);
	writeCookie(PRESENT_COOKIE, '1', 365);
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
}

export async function loadJwxtCookieFromVault(vaultPassword: string): Promise<string> {
	if (!browser) throw new Error('Vault only available in browser');
	const current = await idbKvGet<unknown>(IDB, IDB_KEY);
	if (current && isVaultPayload(current)) {
		writeCookie(PRESENT_COOKIE, '1', 365);
		return decryptVaultText(current, vaultPassword);
	}

	let raw = '';
	try {
		raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY) ?? '';
	} catch {
		raw = '';
	}
	if (!raw) throw new Error('NO_VAULT');
	const parsed = JSON.parse(raw) as unknown;
	if (!isVaultPayload(parsed)) throw new Error('INVALID_VAULT');
	await idbKvPut(IDB, IDB_KEY, parsed);
	writeCookie(PRESENT_COOKIE, '1', 365);
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
	return decryptVaultText(parsed, vaultPassword);
}

export function clearJwxtCookieVault() {
	if (!browser) return;
	void idbKvDelete(IDB, IDB_KEY);
	clearCookie(PRESENT_COOKIE);
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		// ignore
	}
}
