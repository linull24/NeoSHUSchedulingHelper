const browser = typeof window !== 'undefined' && typeof document !== 'undefined';

type ResetResult = {
	ok: boolean;
	errors: string[];
};

function toMessage(error: unknown): string {
	if (error instanceof Error) return error.message || 'Error';
	return String(error);
}

async function deleteIndexedDb(name: string): Promise<void> {
	if (!browser) return;
	if (typeof indexedDB === 'undefined' || !indexedDB.deleteDatabase) return;
	await new Promise<void>((resolve) => {
		const req = indexedDB.deleteDatabase(name);
		req.onsuccess = () => resolve();
		req.onerror = () => resolve();
		req.onblocked = () => resolve();
	});
}

async function deleteOpfsFile(file: string): Promise<void> {
	if (!browser) return;
	const navAny: any = typeof navigator !== 'undefined' ? (navigator as any) : null;
	if (!navAny?.storage?.getDirectory) return;
	const root: any = await navAny.storage.getDirectory();
	if (!root?.removeEntry) return;
	try {
		await root.removeEntry(file);
	} catch {
		// ignore
	}
}

function clearLocalStorageKeys(): void {
	if (!browser) return;
	if (typeof localStorage === 'undefined') return;
	const keys = Object.keys(localStorage);
	for (const key of keys) {
		if (
			key.startsWith('shu-course-scheduler') ||
			key.startsWith('jwxt.') ||
			key.startsWith('jwxt_cookie_') ||
			key.startsWith('setupWizard.') ||
			key === 'ui-theme' ||
			key === 'github:token' ||
			key === 'fluent-theme-color' ||
			key === 'material-theme-color'
		) {
			try {
				localStorage.removeItem(key);
			} catch {
				// ignore
			}
		}
	}
}

export async function resetAllLocalData(): Promise<ResetResult> {
	const errors: string[] = [];
	if (!browser) return { ok: false, errors: ['NOT_IN_BROWSER'] };

	// Clear key cookies/markers (avoid importing stores to keep Vite dev/SSG happy).
	// Setup wizard
	try {
		document.cookie = `setup_wizard_done_v1=; Max-Age=0; Path=/; SameSite=Lax`;
	} catch (e) {
		errors.push(`cookie:setup_wizard_done_v1: ${toMessage(e)}`);
	}
	// JWXT cookie vault presence markers
	try {
		document.cookie = `jwxt_cookie_password_vault_present_v1=; Max-Age=0; Path=/; SameSite=Lax`;
		document.cookie = `jwxt_cookie_device_vault_present_v1=; Max-Age=0; Path=/; SameSite=Lax`;
	} catch (e) {
		errors.push(`cookie:jwxt_cookie_*: ${toMessage(e)}`);
	}

	// Close DB connections before deleting persisted storage.
	// NOTE: Avoid importing QueryLayer here; in some dev/SSG setups it can be resolved through
	// different module graphs and break Vite import analysis. A hard reload is enough to release
	// any open handles after we request deletion.

	// Clear localStorage (best-effort, scoped by prefixes).
	try {
		clearLocalStorageKeys();
	} catch (e) {
		errors.push(`localStorage: ${toMessage(e)}`);
	}

	// Explicitly clear a few known legacy keys (in case prefixes change).
	try {
		localStorage.removeItem('setupWizard.v1.done');
		localStorage.removeItem('jwxt.cookieVault.present.v1');
		localStorage.removeItem('jwxt.cookieDeviceVault.present.v1');
		localStorage.removeItem('jwxt.cookieVault.v1');
		localStorage.removeItem('jwxt.cookieDeviceVault.v1');
	} catch {
		// ignore
	}

	// Clear IndexedDB databases used by the app (best-effort).
	const idbNames = [
		'shu-course-scheduler.queryLayer.sqljs.v1',
		'shu-course-scheduler.deviceVault.v1',
		'shu-course-scheduler.jwxtCookieVaultPayload.v1',
		'shu-course-scheduler.jwxtCookieDeviceVaultPayload.v1'
	];
	for (const name of idbNames) {
		try {
			await deleteIndexedDb(name);
		} catch (e) {
			errors.push(`indexedDB:${name}: ${toMessage(e)}`);
		}
	}

	// Clear OPFS-backed DuckDB file (best-effort; may be unsupported/locked).
	try {
		await deleteOpfsFile('shu-course-scheduler.duckdb.v1');
	} catch (e) {
		errors.push(`opfs: ${toMessage(e)}`);
	}

	return { ok: errors.length === 0, errors };
}
