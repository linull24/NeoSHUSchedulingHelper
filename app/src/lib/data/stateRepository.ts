import { getQueryLayer } from './db/createQueryLayer';
import type { SelectionMatrixState, SelectionMatrixDimensions } from './selectionMatrix';
import { createEmptySelectionMatrixState, SelectionMatrixStore } from './selectionMatrix';
import { ActionLog, type ActionLogEntry, type SelectionTarget, type SolverOverrideMode } from './actionLog';
import type { ManualUpdate } from './manualUpdates';
import type { SolverResultRecord } from './solver/resultTypes';
import { encodeBase64, decodeBase64 } from './utils/base64';
import { getTermConfig, type TermConfig, DEFAULT_TERM_ID } from '../../config/term';

const SELECTION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS selection_matrix_state (
	id TEXT PRIMARY KEY,
	payload TEXT NOT NULL
)`;

const ACTION_LOG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS action_log (
	id TEXT PRIMARY KEY,
	termId TEXT NOT NULL,
	timestamp BIGINT NOT NULL,
	action TEXT NOT NULL,
	payload TEXT,
	version TEXT,
	undo TEXT,
	dockSessionId TEXT,
	selectionSnapshot TEXT,
	solverResultId TEXT,
	defaultTarget TEXT,
	overrideMode TEXT,
	revertedEntryId TEXT
)`;

const ACTION_LOG_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_action_log_timestamp ON action_log (termId, timestamp)`;

const SOLVER_RESULT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS solver_result (
	id TEXT PRIMARY KEY,
	status TEXT NOT NULL,
	solver TEXT NOT NULL,
	runType TEXT NOT NULL DEFAULT 'manual',
	desiredSignature TEXT,
	selectionSignature TEXT,
	createdAt BIGINT NOT NULL,
	metrics TEXT,
	assignment TEXT,
	plan TEXT NOT NULL,
	unsatCore TEXT,
	diagnostics TEXT,
	note TEXT
)`;

const SOLVER_RESULT_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_solver_result_createdAt ON solver_result (createdAt DESC)`;

const LEGACY_SELECTION_KEY = 'selection_matrix';

export async function saveSelectionMatrixState(state: SelectionMatrixState, termOverrides?: Partial<TermConfig>) {
	const layer = await getQueryLayer();
	await layer.exec(SELECTION_TABLE_SQL);
	const payload = JSON.stringify(state);
	await layer.exec(
		`INSERT OR REPLACE INTO selection_matrix_state (id, payload) VALUES ('${
			getTermConfig(termOverrides).currentTermId
		}', '${escapeLiteral(payload)}')`
	);
}

export async function loadSelectionMatrixState(
	dimensions: SelectionMatrixDimensions,
	termOverrides?: Partial<TermConfig>
): Promise<SelectionMatrixState> {
	const layer = await getQueryLayer();
	await layer.exec(SELECTION_TABLE_SQL);
	const payload = await loadSelectionPayload(layer, termOverrides);
	if (!payload) return createEmptySelectionMatrixState(dimensions);
	try {
		const parsed = JSON.parse(payload) as SelectionMatrixState;
		return new SelectionMatrixStore(dimensions, parsed).snapshot;
	} catch (error) {
		console.warn('[StateRepo] 无法解析 selection matrix，返回空矩阵', error);
		return createEmptySelectionMatrixState(dimensions);
	}
}

export async function saveActionLog(log: ActionLog, termOverrides?: Partial<TermConfig>) {
	const layer = await getQueryLayer();
	await ensureActionLogSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	await layer.exec('BEGIN TRANSACTION');
	try {
		await layer.exec(`DELETE FROM action_log WHERE termId = '${termId}'`);
		for (const entry of log.toJSON()) {
			await layer.exec(toActionLogInsert(entry, termId));
		}
		await layer.exec('COMMIT');
	} catch (error) {
		await layer.exec('ROLLBACK');
		throw error;
	}
}

export async function appendActionLogEntry(entry: ActionLogEntry, termOverrides?: Partial<TermConfig>) {
	const layer = await getQueryLayer();
	await ensureActionLogSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	await layer.exec(toActionLogInsert(entry, termId));
}

export async function loadActionLog(termOverrides?: Partial<TermConfig>, limit?: number): Promise<ActionLog> {
	const layer = await getQueryLayer();
	await ensureActionLogSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	const rows = await layer.exec<{
		id: string;
		termId?: string;
		timestamp: number;
		action: string;
		payload?: string;
		version?: string;
		undo?: string;
		dockSessionId?: string;
		selectionSnapshot?: string;
		solverResultId?: string;
		defaultTarget?: string;
		overrideMode?: string;
		revertedEntryId?: string;
	}>(
		`SELECT * FROM action_log WHERE termId = '${termId}' ORDER BY timestamp ASC${
			typeof limit === 'number' ? ` LIMIT ${limit}` : ''
		}`
	);
	const entries: ActionLogEntry[] = rows.map((row) => ({
		id: row.id,
		timestamp: row.timestamp,
		termId: row.termId ?? termId,
		action: row.action,
		payload: row.payload ? safeJson(row.payload) : undefined,
		versionBase64: row.version,
		undo: row.undo ? (safeJson(row.undo) as ManualUpdate[]) : undefined,
		dockSessionId: row.dockSessionId ?? undefined,
		selectionSnapshotBase64: row.selectionSnapshot ?? undefined,
		solverResultId: row.solverResultId ?? undefined,
		defaultTarget: parseTarget(row.defaultTarget),
		overrideMode: parseOverrideMode(row.overrideMode),
		revertedEntryId: row.revertedEntryId ?? undefined
	}));
	return ActionLog.fromJSON(entries);
}

export async function saveSolverResult(record: SolverResultRecord) {
	const layer = await getQueryLayer();
	await ensureSolverResultSchema(layer);
	const metrics = record.metrics ? `'${escapeLiteral(JSON.stringify(record.metrics))}'` : 'NULL';
	const assignment = record.assignment
		? `'${escapeLiteral(encodeBase64(JSON.stringify(record.assignment)))}'`
		: 'NULL';
	const plan = `'${escapeLiteral(encodeBase64(JSON.stringify(record.plan ?? [])))}'`;
	const unsat = record.unsatCore
		? `'${escapeLiteral(JSON.stringify(record.unsatCore))}'`
		: 'NULL';
	const note = record.note ? `'${escapeLiteral(record.note)}'` : 'NULL';
	await layer.exec(`INSERT OR REPLACE INTO solver_result
    (id, termId, status, solver, runType, desiredSignature, selectionSignature, createdAt, metrics, assignment, plan, unsatCore, diagnostics, note)
    VALUES (
      '${escapeLiteral(record.id)}',
      '${escapeLiteral(record.termId)}',
      '${escapeLiteral(record.status)}',
      '${escapeLiteral(record.solver)}',
      '${escapeLiteral(record.runType)}',
      ${record.desiredSignature ? `'${escapeLiteral(record.desiredSignature)}'` : 'NULL'},
      ${record.selectionSignature ? `'${escapeLiteral(record.selectionSignature)}'` : 'NULL'},
      ${record.createdAt},
      ${metrics},
      ${assignment},
      ${plan},
      ${unsat},
      ${record.diagnostics ? `'${escapeLiteral(JSON.stringify(record.diagnostics))}'` : 'NULL'},
      ${note}
    )`);
}

export async function listSolverResults(termOverrides?: Partial<TermConfig>, limit = 10): Promise<SolverResultRecord[]> {
	const layer = await getQueryLayer();
	await ensureSolverResultSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	const rows = await layer.exec<{
		id: string;
		termId: string;
		status: string;
		solver: string;
		runType?: string;
		desiredSignature?: string;
		selectionSignature?: string;
		createdAt: number;
		metrics?: string;
		assignment?: string;
		plan: string;
		unsatCore?: string;
		diagnostics?: string;
		note?: string;
	}>(`SELECT * FROM solver_result WHERE termId = '${termId}' ORDER BY createdAt DESC${limit ? ` LIMIT ${limit}` : ''}`);
	return rows.map(deserializeSolverRow);
}

export async function getSolverResult(id: string, termOverrides?: Partial<TermConfig>): Promise<SolverResultRecord | null> {
	const layer = await getQueryLayer();
	await ensureSolverResultSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	const rows = await layer.exec<{
		id: string;
		termId: string;
		status: string;
		solver: string;
		runType?: string;
		desiredSignature?: string;
		selectionSignature?: string;
		createdAt: number;
		metrics?: string;
		assignment?: string;
		plan: string;
		unsatCore?: string;
		diagnostics?: string;
		note?: string;
	}>(`SELECT * FROM solver_result WHERE id = '${escapeLiteral(id)}' AND termId = '${termId}'`);
	if (!rows.length) return null;
	return deserializeSolverRow(rows[0]);
}

export async function deleteSolverResult(id: string, termOverrides?: Partial<TermConfig>) {
	const layer = await getQueryLayer();
	await ensureSolverResultSchema(layer);
	const termId = getTermConfig(termOverrides).currentTermId;
	await layer.exec(`DELETE FROM solver_result WHERE id = '${escapeLiteral(id)}' AND termId = '${termId}'`);
}

function toActionLogInsert(entry: ActionLogEntry, termId: string) {
	const payload = entry.payload ? `'${escapeLiteral(JSON.stringify(entry.payload))}'` : 'NULL';
	const undo = entry.undo ? `'${escapeLiteral(JSON.stringify(entry.undo))}'` : 'NULL';
	const version = entry.versionBase64 ? `'${escapeLiteral(entry.versionBase64)}'` : 'NULL';
	const dock = entry.dockSessionId ? `'${escapeLiteral(entry.dockSessionId)}'` : 'NULL';
	const snapshot = entry.selectionSnapshotBase64 ? `'${escapeLiteral(entry.selectionSnapshotBase64)}'` : 'NULL';
	const solverResultId = entry.solverResultId ? `'${escapeLiteral(entry.solverResultId)}'` : 'NULL';
	const defaultTarget = entry.defaultTarget ? `'${escapeLiteral(entry.defaultTarget)}'` : 'NULL';
	const overrideMode = entry.overrideMode ? `'${escapeLiteral(entry.overrideMode)}'` : 'NULL';
	const revertedEntryId = entry.revertedEntryId ? `'${escapeLiteral(entry.revertedEntryId)}'` : 'NULL';
	return `INSERT OR REPLACE INTO action_log (id, termId, timestamp, action, payload, version, undo, dockSessionId, selectionSnapshot, solverResultId, defaultTarget, overrideMode, revertedEntryId)
	  VALUES ('${entry.id}', '${termId}', ${entry.timestamp}, '${escapeLiteral(entry.action)}', ${payload}, ${version}, ${undo}, ${dock}, ${snapshot}, ${solverResultId}, ${defaultTarget}, ${overrideMode}, ${revertedEntryId})`;
}

async function loadSelectionPayload(layer: Awaited<ReturnType<typeof getQueryLayer>>, termOverrides?: Partial<TermConfig>) {
	const termId = getTermConfig(termOverrides).currentTermId;
	const rows = await layer.exec<{ payload: string }>(`SELECT payload FROM selection_matrix_state WHERE id = '${termId}'`);
	if (rows.length) return rows[0].payload;
	if (termId !== DEFAULT_TERM_ID) {
		const fallback = await layer.exec<{ payload: string }>(
			`SELECT payload FROM selection_matrix_state WHERE id = '${DEFAULT_TERM_ID}'`
		);
		if (fallback.length) return fallback[0].payload;
	}
	const legacy = await layer.exec<{ payload: string }>(
		`SELECT payload FROM selection_matrix_state WHERE id = '${LEGACY_SELECTION_KEY}'`
	);
	if (legacy.length) return legacy[0].payload;
	return null;
}

function escapeLiteral(value: string) {
	return value.replace(/'/g, "''");
}

function safeJson(value: string) {
	try {
		return JSON.parse(value);
	} catch (error) {
		console.warn('[StateRepo] JSON 解析失败，返回空对象', error);
		return {};
	}
}

async function ensureActionLogSchema(layer: Awaited<ReturnType<typeof getQueryLayer>>) {
	await layer.exec(ACTION_LOG_TABLE_SQL);
	await ensureTableColumn(
		layer,
		'action_log',
		'termId',
		`ALTER TABLE action_log ADD COLUMN termId TEXT DEFAULT '${DEFAULT_TERM_ID}'`
	);
	await ensureTableColumn(layer, 'action_log', 'dockSessionId', 'ALTER TABLE action_log ADD COLUMN dockSessionId TEXT');
	await ensureTableColumn(layer, 'action_log', 'selectionSnapshot', 'ALTER TABLE action_log ADD COLUMN selectionSnapshot TEXT');
	await ensureTableColumn(layer, 'action_log', 'solverResultId', 'ALTER TABLE action_log ADD COLUMN solverResultId TEXT');
	await ensureTableColumn(layer, 'action_log', 'defaultTarget', 'ALTER TABLE action_log ADD COLUMN defaultTarget TEXT');
	await ensureTableColumn(layer, 'action_log', 'overrideMode', 'ALTER TABLE action_log ADD COLUMN overrideMode TEXT');
	await ensureTableColumn(layer, 'action_log', 'revertedEntryId', 'ALTER TABLE action_log ADD COLUMN revertedEntryId TEXT');
	await ensureDuckdbBigintColumn(layer, {
		table: 'action_log',
		column: 'timestamp',
		backupTable: 'action_log__timestamp_backup',
		dropIndexes: ['idx_action_log_timestamp'],
		recreateTableSql: ACTION_LOG_TABLE_SQL,
		columnsToCopy: [
			'id',
			'termId',
			'timestamp',
			'action',
			'payload',
			'version',
			'undo',
			'dockSessionId',
			'selectionSnapshot',
			'solverResultId',
			'defaultTarget',
			'overrideMode',
			'revertedEntryId'
		],
		selectExpressions: [
			'id',
			`COALESCE(termId, '${DEFAULT_TERM_ID}') AS termId`,
			'CAST(COALESCE(timestamp, 0) AS BIGINT) AS timestamp',
			`COALESCE(action, 'unknown') AS action`,
			'payload',
			'version',
			'undo',
			'dockSessionId',
			'selectionSnapshot',
			'solverResultId',
			'defaultTarget',
			'overrideMode',
			'revertedEntryId'
		]
	});
	await layer.exec(ACTION_LOG_INDEX_SQL);
}

async function ensureSolverResultSchema(layer: Awaited<ReturnType<typeof getQueryLayer>>) {
	await layer.exec(SOLVER_RESULT_TABLE_SQL);
	await ensureTableColumn(
		layer,
		'solver_result',
		'termId',
		`ALTER TABLE solver_result ADD COLUMN termId TEXT DEFAULT '${DEFAULT_TERM_ID}'`
	);
	await ensureTableColumn(layer, 'solver_result', 'runType', "ALTER TABLE solver_result ADD COLUMN runType TEXT DEFAULT 'manual'");
	await ensureTableColumn(layer, 'solver_result', 'diagnostics', 'ALTER TABLE solver_result ADD COLUMN diagnostics TEXT');
	await ensureDuckdbBigintColumn(layer, {
		table: 'solver_result',
		column: 'createdAt',
		backupTable: 'solver_result__createdAt_backup',
		dropIndexes: ['idx_solver_result_createdAt'],
		recreateTableSql: SOLVER_RESULT_TABLE_SQL,
		columnsToCopy: [
			'id',
			'termId',
			'status',
			'solver',
			'runType',
			'desiredSignature',
			'selectionSignature',
			'createdAt',
			'metrics',
			'assignment',
			'plan',
			'unsatCore',
			'diagnostics',
			'note'
		],
		selectExpressions: [
			'id',
			`COALESCE(termId, '${DEFAULT_TERM_ID}') AS termId`,
			`COALESCE(status, 'sat') AS status`,
			`COALESCE(solver, 'unknown') AS solver`,
			`COALESCE(runType, 'manual') AS runType`,
			'desiredSignature',
			'selectionSignature',
			'CAST(COALESCE(createdAt, 0) AS BIGINT) AS createdAt',
			'metrics',
			'assignment',
			`COALESCE(plan, 'W10=') AS plan`,
			'unsatCore',
			'diagnostics',
			'note'
		]
	});
	await layer.exec(SOLVER_RESULT_INDEX_SQL);
}

async function ensureTableColumn(
	layer: Awaited<ReturnType<typeof getQueryLayer>>,
	table: string,
	column: string,
	alterSQL: string
) {
	const columns = await layer.exec<{ name: string }>(`PRAGMA table_info(${table})`);
	if (!columns.some((col) => col.name === column)) {
		await layer.exec(alterSQL);
	}
}

async function ensureDuckdbBigintColumn(
	layer: Awaited<ReturnType<typeof getQueryLayer>>,
	opts: {
		table: string;
		column: string;
		backupTable: string;
		dropIndexes: string[];
		recreateTableSql: string;
		columnsToCopy: string[];
		selectExpressions?: string[];
	}
) {
	if (layer.engine !== 'duckdb') return;

	const columns = await layer.exec<{ name: string; type?: string }>(`PRAGMA table_info(${opts.table})`);
	const target = columns.find((col) => col.name === opts.column);
	if (!target) return;

	if (typeof target.type === 'string' && target.type.toUpperCase() === 'BIGINT') return;

	for (const idx of opts.dropIndexes) {
		await layer.exec(`DROP INDEX IF EXISTS ${idx}`);
	}

	try {
		await layer.exec(`ALTER TABLE ${opts.table} ALTER COLUMN ${opts.column} SET DATA TYPE BIGINT`);
	} catch (error) {
		console.warn(`[StateRepo] 无法升级 ${opts.table}.${opts.column} 为 BIGINT，尝试重建表`, error);
		const cols = opts.columnsToCopy.join(', ');
		const select = (opts.selectExpressions ?? opts.columnsToCopy).join(', ');
		await layer.exec(`ALTER TABLE ${opts.table} RENAME TO ${opts.backupTable}`);
		await layer.exec(opts.recreateTableSql);
		await layer.exec(`INSERT INTO ${opts.table} (${cols}) SELECT ${select} FROM ${opts.backupTable}`);
		await layer.exec(`DROP TABLE ${opts.backupTable}`);
	}
}

function deserializeSolverRow(row: {
	id: string;
	termId: string;
	status: string;
	solver: string;
	runType?: string;
	desiredSignature?: string;
	selectionSignature?: string;
	createdAt: number;
	metrics?: string;
	assignment?: string;
	plan: string;
	unsatCore?: string;
	diagnostics?: string;
	note?: string;
}): SolverResultRecord {
	return {
		id: row.id,
		termId: row.termId,
		status: (row.status as 'sat' | 'unsat') ?? 'sat',
		solver: row.solver,
		runType: (row.runType as 'auto' | 'manual') ?? 'manual',
		desiredSignature: row.desiredSignature ?? '',
		selectionSignature: row.selectionSignature ?? '',
		createdAt: row.createdAt,
		metrics: row.metrics ? JSON.parse(row.metrics) : { variables: 0, hard: 0, soft: 0, elapsedMs: 0 },
		assignment: row.assignment ? (JSON.parse(decodeBase64(row.assignment)) as Record<string, boolean>) : undefined,
		plan: row.plan ? (JSON.parse(decodeBase64(row.plan)) as ManualUpdate[]) : [],
		unsatCore: row.unsatCore ? (JSON.parse(row.unsatCore) as string[]) : undefined,
		diagnostics: row.diagnostics ? (JSON.parse(row.diagnostics) as SolverResultRecord['diagnostics']) : undefined,
		note: row.note ?? undefined
	};
}

function parseTarget(value?: string): SelectionTarget | undefined {
	if (value === 'selected' || value === 'wishlist') {
		return value;
	}
	return undefined;
}

function parseOverrideMode(value?: string): SolverOverrideMode | undefined {
	if (value === 'merge' || value === 'replace-all') {
		return value;
	}
	return undefined;
}
