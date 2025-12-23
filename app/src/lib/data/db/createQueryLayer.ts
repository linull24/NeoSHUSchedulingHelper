import * as duckdb from '@duckdb/duckdb-wasm';
import initSqlJs from 'sql.js';
import sqlJsWasm from 'sql.js/dist/sql-wasm.wasm?url';
import path from 'node:path';
import { getQueryLayerConfig, type QueryLayerConfig } from '../../../config/queryLayer';

export interface QueryLayer {
	engine: 'duckdb' | 'sqljs';
	exec<T = unknown>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
	close(): Promise<void>;
}

let dbPromise: Promise<QueryLayer> | null = null;
let currentEngine: QueryLayerConfig['engine'] | null = null;
let duckdbFallbackWarned = false;

const duckdbWasmMvp = new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href;
const duckdbWasmEh = new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href;
const duckdbWasmCoi = new URL('@duckdb/duckdb-wasm/dist/duckdb-coi.wasm', import.meta.url).href;
const duckdbWorkerMvp = new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href;
const duckdbWorkerEh = new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href;
const duckdbWorkerCoi = new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-coi.worker.js', import.meta.url).href;
const duckdbPThreadWorker = new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-coi.pthread.worker.js', import.meta.url).href;

const LOCAL_BUNDLES: duckdb.DuckDBBundles = {
	mvp: {
		mainModule: duckdbWasmMvp,
		mainWorker: duckdbWorkerMvp
	},
	eh: {
		mainModule: duckdbWasmEh,
		mainWorker: duckdbWorkerEh
	},
	coi: {
		mainModule: duckdbWasmCoi,
		mainWorker: duckdbWorkerCoi,
		pthreadWorker: duckdbPThreadWorker
	}
};

const SQLJS_PERSIST = {
	dbName: 'shu-course-scheduler.queryLayer.sqljs.v1',
	storeName: 'db'
} as const;
const SQLJS_PERSIST_KEY: IDBValidKey = 'main';

function isBrowserEnv() {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function preflightOpfsDbLock(file: string) {
	const navAny: any = typeof navigator !== 'undefined' ? (navigator as any) : null;
	if (!navAny?.storage?.getDirectory) throw new Error('DUCKDB_OPFS_UNSUPPORTED');
	const root: any = await navAny.storage.getDirectory();
	if (!root?.getFileHandle) throw new Error('DUCKDB_OPFS_UNSUPPORTED');
	const fileHandle: any = await root.getFileHandle(file, { create: true });
	const createSyncAccessHandle: any = fileHandle?.createSyncAccessHandle?.bind(fileHandle);
	if (typeof createSyncAccessHandle !== 'function') throw new Error('DUCKDB_OPFS_UNSUPPORTED');
	let handle: any = null;
	try {
		handle = await createSyncAccessHandle();
	} catch (error) {
		// Most common: "Access Handles cannot be created if there is another open Access Handle or Writable stream..."
		throw new Error(`DUCKDB_OPFS_LOCKED:${toErrorInfo(error).message}`);
	} finally {
		try {
			handle?.close?.();
		} catch {
			// ignore
		}
	}
}

export async function getQueryLayer(overrides?: Partial<QueryLayerConfig>) {
	if (dbPromise) return dbPromise;
	const config = getQueryLayerConfig(overrides);
	dbPromise = instantiateLayer(config).catch((error) => {
		dbPromise = null;
		currentEngine = null;
		throw error;
	});
	return dbPromise;
}

export function resetQueryLayer() {
	const existing = dbPromise;
	dbPromise = null;
	currentEngine = null;
	void existing?.then((layer) => layer.close()).catch(() => {});
}

async function instantiateLayer(config: QueryLayerConfig): Promise<QueryLayer> {
	const shouldForceFallback = (error: unknown) => {
		const msg = toErrorInfo(error).message || '';
		// OPFS unavailability/lock means DuckDB persistence cannot be used reliably in the browser.
		// In this case, always fall back to sql.js (even when strictEngine is enabled) to avoid
		// breaking term_state persistence and to keep the app usable.
		return /^DUCKDB_OPFS_(UNSUPPORTED|LOCKED|OPEN_FAILED)/.test(msg);
	};

	const warnDuckdbFallback = (error: unknown) => {
		if (duckdbFallbackWarned) return;
		duckdbFallbackWarned = true;
		console.warn('[DB] DuckDB-Wasm 初始化失败，回退至 sql.js', toErrorInfo(error));
	};

	const canUseDuckdbOpfs = () => {
		if (!isBrowserEnv()) return false;
		try {
			// DuckDB OPFS persistence relies on OPFS Sync Access Handles.
			return typeof (globalThis as any).FileSystemFileHandle?.prototype?.createSyncAccessHandle === 'function';
		} catch {
			return false;
		}
	};
	if (currentEngine && config.engine === currentEngine && dbPromise) {
		return dbPromise;
	}
	switch (config.engine) {
		case 'duckdb':
			try {
				currentEngine = 'duckdb';
				return await initDuckDB();
			} catch (error) {
				if (config.strictEngine && !shouldForceFallback(error)) throw error;
				warnDuckdbFallback(error);
				currentEngine = 'sqljs';
				return createFallbackLayer();
			}
		case 'sqljs':
			currentEngine = 'sqljs';
			return createFallbackLayer();
		default:
			if (!canUseDuckdbOpfs()) {
				currentEngine = 'sqljs';
				return createFallbackLayer();
			}
			try {
				currentEngine = 'duckdb';
				return await initDuckDB();
			} catch (error) {
				if (config.strictEngine && !shouldForceFallback(error)) throw error;
				warnDuckdbFallback(error);
				currentEngine = 'sqljs';
				return createFallbackLayer();
			}
	}
}

async function initDuckDB(): Promise<QueryLayer> {
	if (typeof Worker === 'undefined' || typeof window === 'undefined') {
		throw new Error('DuckDB-Wasm 需要浏览器环境');
	}

	const opfsDbFile = 'shu-course-scheduler.duckdb.v1';
	// Avoid creating a DuckDB worker when OPFS is unavailable or the DB file is locked.
	// This makes engine fallback deterministic and avoids noisy errors during HMR/multi-tab.
	if (isBrowserEnv()) {
		await preflightOpfsDbLock(opfsDbFile);
	}

	const bundle = await duckdb.selectBundle(LOCAL_BUNDLES);
	if (!bundle) throw new Error('未能获取 DuckDB-Wasm bundle');

	if (!bundle.mainWorker) throw new Error('DuckDB bundle 缺少 mainWorker');
	const worker = new Worker(bundle.mainWorker, { type: 'module' });
	const logger = new duckdb.VoidLogger();
	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

	// Persistence: use OPFS-backed database file when available.
	// DuckDB-Wasm supports `opfs://` paths. If OPFS is unavailable, DuckDB falls back to ephemeral storage.
	if (isBrowserEnv()) {
		try {
			const opfsPath = `opfs://${opfsDbFile}`;
			// DuckDB expects an OPFS path (with `opfs://` prefix) when registering OPFS filenames.
			await db.registerOPFSFileName(opfsPath);
			await db.open({ path: opfsPath, accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
		} catch (error) {
			// Do NOT silently continue with an in-memory DB; fall back to persisted sql.js instead.
			throw new Error(`DUCKDB_OPFS_OPEN_FAILED:${toErrorInfo(error).message}`);
		}
	}

	const conn = await db.connect();
	let closed = false;

	// Perf: cache compiled named-param templates and prepared statements.
	// This keeps the query path fast for hot loops (e.g. state repo reads/writes, UI lists).
	// Keep cache sizes small to avoid unbounded growth.
	const COMPILED_LRU_MAX = 64;
	const STMT_LRU_MAX = 24;
	const compiledCache = new Map<string, { sql: string; keys: string[] }>();
	const stmtCache = new Map<string, any>();

	function touchLru<K, V>(map: Map<K, V>, key: K, value: V) {
		if (map.has(key)) map.delete(key);
		map.set(key, value);
	}

	function evictLru<K, V>(map: Map<K, V>, max: number, onEvict?: (value: V) => void) {
		while (map.size > max) {
			const firstKey = map.keys().next().value as K | undefined;
			if (firstKey === undefined) return;
			const v = map.get(firstKey) as V;
			map.delete(firstKey);
			onEvict?.(v);
		}
	}

	function compileNamedParamsForDuckDBCached(sql: string): { sql: string; keys: string[] } {
		const cached = compiledCache.get(sql);
		if (cached) {
			touchLru(compiledCache, sql, cached);
			return cached;
		}
		const compiled = compileNamedParamsPlanForDuckDB(sql);
		touchLru(compiledCache, sql, compiled);
		evictLru(compiledCache, COMPILED_LRU_MAX);
		return compiled;
	}

	async function getPreparedStatement(compiledSql: string) {
		const existing = stmtCache.get(compiledSql);
		if (existing) {
			touchLru(stmtCache, compiledSql, existing);
			return existing;
		}
		const stmt = await conn.prepare(compiledSql);
		touchLru(stmtCache, compiledSql, stmt);
		evictLru(stmtCache, STMT_LRU_MAX, (v) => {
			try {
				void v?.close?.();
			} catch {
				// ignore
			}
		});
		return stmt;
	}

	return {
		engine: 'duckdb',
		async exec<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
			if (closed) throw new Error('QueryLayer 已关闭');
			if (!params || Object.keys(params).length === 0) {
				return (await conn.query(sql)).toArray() as T[];
			}
			const compiled = compileNamedParamsForDuckDBCached(sql);
			const values = compiled.keys.map((key) => {
				if (!(key in params)) throw new Error(`缺少 SQL 参数 :${key}`);
				return normalizeSqlValue(params[key]);
			});
			const stmt = await getPreparedStatement(compiled.sql);
			return (await stmt.query(...values)).toArray() as T[];
		},
		async close() {
			if (closed) return;
			closed = true;
			try {
				await db.flushFiles();
			} catch {
				// ignore
			}
			for (const stmt of stmtCache.values()) {
				try {
					await stmt?.close?.();
				} catch {
					// ignore
				}
			}
			stmtCache.clear();
			compiledCache.clear();
			await conn.close();
			await db.terminate();
		}
	};
}

// Dev ergonomics: ensure OPFS handles are released on HMR dispose.
// Without this, the next init may fail with DUCKDB_OPFS_* errors.
try {
	(import.meta as any).hot?.dispose(() => resetQueryLayer());
} catch {
	// ignore
}

async function createFallbackLayer(): Promise<QueryLayer> {
	const SQL = await initSqlJs({
		locateFile: (file: string) => {
			if (typeof window === 'undefined') {
				// SSR/Node: use local node_modules.
				return path.resolve(process.cwd(), 'node_modules/sql.js/dist', file);
			}
			if (file === 'sql-wasm.wasm') return sqlJsWasm;
			return file;
		}
	});

	// Browser persistence: load and store sql.js database bytes in IndexedDB.
	// This makes termState/actionLog/solver results survive refresh/reopen.
	let db: any;
	if (isBrowserEnv()) {
		try {
			const { idbKvGet } = await import('../../utils/idbKv');
			const stored = await idbKvGet<unknown>(SQLJS_PERSIST, SQLJS_PERSIST_KEY);
			if (stored instanceof ArrayBuffer) db = new SQL.Database(new Uint8Array(stored));
			else if (stored instanceof Uint8Array) db = new SQL.Database(stored);
			else if (stored && typeof stored === 'object' && (stored as any).buffer instanceof ArrayBuffer) {
				db = new SQL.Database(new Uint8Array((stored as any).buffer));
			} else {
				db = new SQL.Database();
			}
		} catch (error) {
			console.warn('[DB] sql.js 持久化加载失败，使用空数据库', toErrorInfo(error));
			db = new SQL.Database();
		}
	} else {
		db = new SQL.Database();
	}

	let closed = false;

	let persistTimer: number | null = null;
	let persistQueued = false;
	let lastPersistError: unknown = null;

	function shouldPersist(sql: string) {
		const trimmed = sql.trimStart();
		return /^(begin|commit|rollback|insert|update|delete|create|drop|alter|replace|vacuum|pragma)/i.test(trimmed);
	}

	function schedulePersist() {
		if (!isBrowserEnv()) return;
		persistQueued = true;
		if (persistTimer !== null) return;

		const flush = async () => {
			persistTimer = null;
			if (!persistQueued || closed) return;
			persistQueued = false;
			try {
				const { idbKvPut } = await import('../../utils/idbKv');
				const bytes: Uint8Array = db.export();
				await idbKvPut(SQLJS_PERSIST, SQLJS_PERSIST_KEY, bytes);
				lastPersistError = null;
			} catch (error) {
				lastPersistError = error;
				console.warn('[DB] sql.js 持久化写入失败', toErrorInfo(error));
			}
		};

		// Prefer idle time to reduce jank on large exports.
		if (typeof (globalThis as any).requestIdleCallback === 'function') {
			(globalThis as any).requestIdleCallback(() => void flush(), { timeout: 1500 });
			persistTimer = window.setTimeout(() => void flush(), 500);
			return;
		}
		persistTimer = window.setTimeout(() => void flush(), 400);
	}

	return {
		engine: 'sqljs',
		async exec<T>(sql: string, params?: Record<string, unknown>) {
			if (closed) throw new Error('QueryLayer 已关闭');
			const result = db.exec(sql, params ? toSqlJsParams(params) : undefined);
			if (isBrowserEnv() && shouldPersist(sql)) schedulePersist();
			if (!result.length) return [];
			const [first] = result;
			const { columns, values } = first;
			return values.map((row: unknown[]) => {
				const record: Record<string, unknown> = {};
				row.forEach((value, index) => {
					record[columns[index]] = value;
				});
				return record as T;
			});
		},
		async close() {
			if (closed) return;
			closed = true;
			if (isBrowserEnv() && lastPersistError) {
				// Best-effort final flush: if persistence was failing, try once more on close.
				try {
					const { idbKvPut } = await import('../../utils/idbKv');
					const bytes: Uint8Array = db.export();
					await idbKvPut(SQLJS_PERSIST, SQLJS_PERSIST_KEY, bytes);
				} catch {
					// ignore
				}
			}
			db.close();
		}
	};
}

function toErrorInfo(error: unknown) {
	return error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
}

function toSqlJsParams(params: Record<string, unknown>): Record<string, number | string | Uint8Array | null> {
	const normalized: Record<string, number | string | Uint8Array | null> = {};
	for (const [key, value] of Object.entries(params)) {
		normalized[`:${key}`] = normalizeSqlValue(value);
	}
	return normalized;
}

function normalizeSqlValue(value: unknown): number | string | Uint8Array | null {
	if (value == null) return null;
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return value;
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'bigint') return value.toString();
	if (value instanceof Uint8Array) return value;
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value) || (typeof value === 'object' && value)) return JSON.stringify(value);
	return String(value);
}

function compileNamedParamsForDuckDB(
	sql: string,
	params: Record<string, unknown>
): { sql: string; values: Array<number | string | Uint8Array | null> } {
	const values: Array<number | string | Uint8Array | null> = [];

	let out = '';
	let i = 0;

	let inSingle = false;
	let inDouble = false;
	let inLineComment = false;
	let inBlockComment = false;

	while (i < sql.length) {
		const ch = sql[i];
		const next = i + 1 < sql.length ? sql[i + 1] : '';

		if (inLineComment) {
			out += ch;
			if (ch === '\n') inLineComment = false;
			i += 1;
			continue;
		}

		if (inBlockComment) {
			out += ch;
			if (ch === '*' && next === '/') {
				out += next;
				i += 2;
				inBlockComment = false;
				continue;
			}
			i += 1;
			continue;
		}

		if (inSingle) {
			out += ch;
			if (ch === "'" && next === "'") {
				out += next;
				i += 2;
				continue;
			}
			if (ch === "'") inSingle = false;
			i += 1;
			continue;
		}

		if (inDouble) {
			out += ch;
			if (ch === '"' && next === '"') {
				out += next;
				i += 2;
				continue;
			}
			if (ch === '"') inDouble = false;
			i += 1;
			continue;
		}

		if (ch === '-' && next === '-') {
			out += ch + next;
			i += 2;
			inLineComment = true;
			continue;
		}

		if (ch === '/' && next === '*') {
			out += ch + next;
			i += 2;
			inBlockComment = true;
			continue;
		}

		if (ch === "'") {
			out += ch;
			i += 1;
			inSingle = true;
			continue;
		}

		if (ch === '"') {
			out += ch;
			i += 1;
			inDouble = true;
			continue;
		}

		if (ch === ':' && next !== ':' && isIdentStart(next)) {
			let j = i + 1;
			while (j < sql.length && isIdentPart(sql[j])) j += 1;
			const name = sql.slice(i + 1, j);
			if (!(name in params)) {
				throw new Error(`缺少 SQL 参数 :${name}`);
			}
			out += '?';
			values.push(normalizeSqlValue(params[name]));
			i = j;
			continue;
		}

		out += ch;
		i += 1;
	}

	return { sql: out, values };
}

function compileNamedParamsPlanForDuckDB(sql: string): { sql: string; keys: string[] } {
	const keys: string[] = [];

	let out = '';
	let i = 0;

	let inSingle = false;
	let inDouble = false;
	let inLineComment = false;
	let inBlockComment = false;

	while (i < sql.length) {
		const ch = sql[i];
		const next = i + 1 < sql.length ? sql[i + 1] : '';

		if (inLineComment) {
			out += ch;
			if (ch === '\n') inLineComment = false;
			i += 1;
			continue;
		}

		if (inBlockComment) {
			out += ch;
			if (ch === '*' && next === '/') {
				out += next;
				i += 2;
				inBlockComment = false;
				continue;
			}
			i += 1;
			continue;
		}

		if (inSingle) {
			out += ch;
			if (ch === "'" && next === "'") {
				out += next;
				i += 2;
				continue;
			}
			if (ch === "'") inSingle = false;
			i += 1;
			continue;
		}

		if (inDouble) {
			out += ch;
			if (ch === '"' && next === '"') {
				out += next;
				i += 2;
				continue;
			}
			if (ch === '"') inDouble = false;
			i += 1;
			continue;
		}

		if (ch === '-' && next === '-') {
			out += ch + next;
			i += 2;
			inLineComment = true;
			continue;
		}

		if (ch === '/' && next === '*') {
			out += ch + next;
			i += 2;
			inBlockComment = true;
			continue;
		}

		if (ch === "'") {
			out += ch;
			i += 1;
			inSingle = true;
			continue;
		}

		if (ch === '"') {
			out += ch;
			i += 1;
			inDouble = true;
			continue;
		}

		if (ch === ':' && next !== ':' && isIdentStart(next)) {
			let j = i + 1;
			while (j < sql.length && isIdentPart(sql[j])) j += 1;
			const name = sql.slice(i + 1, j);
			out += '?';
			keys.push(name);
			i = j;
			continue;
		}

		out += ch;
		i += 1;
	}

	return { sql: out, keys };
}

function isIdentStart(ch: string) {
	return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string) {
	return /[A-Za-z0-9_]/.test(ch);
}
