import { browser } from '$app/environment';

type DbOptions = {
	dbName: string;
	storeName: string;
	version?: number;
};

function openDb(options: DbOptions): Promise<IDBDatabase> {
	if (!browser) throw new Error('IndexedDB only available in browser');
	const version = options.version ?? 1;
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(options.dbName, version);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(options.storeName)) db.createObjectStore(options.storeName);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
	});
}

export async function idbKvGet<T>(options: DbOptions, key: IDBValidKey): Promise<T | undefined> {
	const db = await openDb(options);
	return new Promise((resolve, reject) => {
		const tx = db.transaction(options.storeName, 'readonly');
		const store = tx.objectStore(options.storeName);
		const req = store.get(key);
		req.onsuccess = () => resolve(req.result as T | undefined);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
	});
}

export async function idbKvPut(options: DbOptions, key: IDBValidKey, value: unknown): Promise<void> {
	const db = await openDb(options);
	return new Promise((resolve, reject) => {
		const tx = db.transaction(options.storeName, 'readwrite');
		const store = tx.objectStore(options.storeName);
		const req = store.put(value, key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error ?? new Error('IndexedDB put failed'));
	});
}

export async function idbKvDelete(options: DbOptions, key: IDBValidKey): Promise<void> {
	const db = await openDb(options);
	return new Promise((resolve, reject) => {
		const tx = db.transaction(options.storeName, 'readwrite');
		const store = tx.objectStore(options.storeName);
		const req = store.delete(key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'));
	});
}

