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
	if (currentEngine && config.engine === currentEngine && dbPromise) {
		return dbPromise;
	}
	switch (config.engine) {
		case 'duckdb':
			try {
				currentEngine = 'duckdb';
				return await initDuckDB();
			} catch (error) {
				if (config.strictEngine) throw error;
				console.warn('[DB] DuckDB-Wasm 初始化失败，回退至 sql.js', toErrorInfo(error));
				currentEngine = 'sqljs';
				return createFallbackLayer();
			}
		case 'sqljs':
			currentEngine = 'sqljs';
			return createFallbackLayer();
		default:
			try {
				currentEngine = 'duckdb';
				return await initDuckDB();
			} catch (error) {
				console.warn('[DB] DuckDB-Wasm 初始化失败，回退至 sql.js', toErrorInfo(error));
				currentEngine = 'sqljs';
				return createFallbackLayer();
			}
	}
}

async function initDuckDB(): Promise<QueryLayer> {
	if (typeof Worker === 'undefined' || typeof window === 'undefined') {
		throw new Error('DuckDB-Wasm 需要浏览器环境');
	}

	const bundle = await duckdb.selectBundle(LOCAL_BUNDLES);
	if (!bundle) throw new Error('未能获取 DuckDB-Wasm bundle');

	if (!bundle.mainWorker) throw new Error('DuckDB bundle 缺少 mainWorker');
	const worker = new Worker(bundle.mainWorker, { type: 'module' });
	const logger = new duckdb.VoidLogger();
	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

	const conn = await db.connect();
	let closed = false;
	return {
		engine: 'duckdb',
		async exec<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
			if (closed) throw new Error('QueryLayer 已关闭');
			if (!params || Object.keys(params).length === 0) {
				return (await conn.query(sql)).toArray() as T[];
			}
			const compiled = compileNamedParamsForDuckDB(sql, params);
			const stmt = await conn.prepare(compiled.sql);
			try {
				return (await stmt.query(...compiled.values)).toArray() as T[];
			} finally {
				await stmt.close();
			}
		},
		async close() {
			if (closed) return;
			closed = true;
			await conn.close();
			await db.terminate();
		}
	};
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
	const db = new SQL.Database();
	let closed = false;
	return {
		engine: 'sqljs',
		async exec<T>(sql: string, params?: Record<string, unknown>) {
			if (closed) throw new Error('QueryLayer 已关闭');
			const result = db.exec(sql, params ? toSqlJsParams(params) : undefined);
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

function isIdentStart(ch: string) {
	return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string) {
	return /[A-Za-z0-9_]/.test(ch);
}
