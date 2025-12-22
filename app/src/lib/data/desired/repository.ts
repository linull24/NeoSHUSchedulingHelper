import type { DesiredState, DesiredCoursePreference, DesiredLock, SoftConstraint } from './types';
import { DEFAULT_DESIRED_STATE } from './types';
import { DesiredStore } from './store';
import { getQueryLayer } from '../db/createQueryLayer';
import { getTermConfig, type TermConfig, DEFAULT_TERM_ID } from '../../../config/term';

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS desired_state (
	termId TEXT PRIMARY KEY,
	payload TEXT NOT NULL
)`;

const LEGACY_KEY = 'desired';
const SHADOW_KEY_PREFIX = 'desired_state.shadow.v1:';

function canUseLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function writeShadowDesiredState(args: { termId: string; payload: string }) {
	if (!canUseLocalStorage()) return;
	try {
		localStorage.setItem(
			`${SHADOW_KEY_PREFIX}${args.termId}`,
			JSON.stringify({
				termId: args.termId,
				payload: args.payload
			})
		);
	} catch {
		// ignore
	}
}

function readShadowDesiredState(termId: string): { termId: string; payload: string } | null {
	if (!canUseLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(`${SHADOW_KEY_PREFIX}${termId}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as any;
		if (!parsed || typeof parsed !== 'object') return null;
		if (String(parsed.termId || '') !== termId) return null;
		const payload = typeof parsed.payload === 'string' ? parsed.payload : '';
		if (!payload) return null;
		return { termId, payload };
	} catch {
		return null;
	}
}

export async function saveDesiredState(state: DesiredState, termOverrides?: Partial<TermConfig>) {
	const layer = await getQueryLayer();
	await layer.exec(TABLE_SQL);
	const json = JSON.stringify(state);
	const termId = getTermConfig(termOverrides).currentTermId;
	await layer.exec(
		`INSERT OR REPLACE INTO desired_state (termId, payload) VALUES ('${termId}', '${json.replace(/'/g, "''")}')`
	);
	writeShadowDesiredState({ termId, payload: json });
}

export async function loadDesiredState(termOverrides?: Partial<TermConfig>): Promise<DesiredStore> {
	const layer = await getQueryLayer();
	await layer.exec(TABLE_SQL);
	const termId = getTermConfig(termOverrides).currentTermId;
	let payload = await loadDesiredPayload(layer, termId);
	if (!payload) {
		const shadow = readShadowDesiredState(termId);
		if (shadow) {
			try {
				const parsed = JSON.parse(shadow.payload) as unknown;
				// Validate shape using existing store parsing downstream; here we only ensure it is JSON.
				await layer.exec(
					`INSERT OR REPLACE INTO desired_state (termId, payload) VALUES ('${termId}', '${shadow.payload.replace(/'/g, "''")}')`
				);
				payload = shadow.payload;
			} catch {
				// ignore
			}
		}
	}
	if (!payload) return new DesiredStore(DEFAULT_DESIRED_STATE);
	try {
		const parsed = JSON.parse(payload) as DesiredState;
		return new DesiredStore(parsed);
	} catch (error) {
		console.warn('[DesiredRepository] 无法解析保存的 state，使用默认值', error);
		return new DesiredStore(DEFAULT_DESIRED_STATE);
	}
}

async function loadDesiredPayload(layer: Awaited<ReturnType<typeof getQueryLayer>>, termId: string) {
	const rows = await layer.exec<{ payload: string }>(
		`SELECT payload FROM desired_state WHERE termId = '${termId}'`
	);
	if (rows.length) return rows[0].payload;
	if (termId !== DEFAULT_TERM_ID) {
		const fallback = await layer.exec<{ payload: string }>(
			`SELECT payload FROM desired_state WHERE termId = '${DEFAULT_TERM_ID}'`
		);
		if (fallback.length) return fallback[0].payload;
	}
	const legacy = await layer.exec<{ payload: string }>(`SELECT payload FROM desired_state WHERE termId = '${LEGACY_KEY}'`);
	if (legacy.length) return legacy[0].payload;
	return null;
}

export async function addDesiredCourse(course: DesiredCoursePreference, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.addCourse(course);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function updateDesiredCourse(
	courseHash: string,
	updater: (course: DesiredCoursePreference) => DesiredCoursePreference,
	termOverrides?: Partial<TermConfig>
) {
	const store = await loadDesiredState(termOverrides);
	store.updateCourse(courseHash, updater);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function removeDesiredCourse(courseHash: string, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.removeCourse(courseHash);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function addDesiredLock(lock: DesiredLock, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.addLock(lock);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function updateDesiredLock(
	lockId: string,
	updater: (lock: DesiredLock) => DesiredLock,
	termOverrides?: Partial<TermConfig>
) {
	const store = await loadDesiredState(termOverrides);
	store.updateLock(lockId, updater);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function removeDesiredLock(lockId: string, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.removeLock(lockId);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function addSoftConstraint(constraint: SoftConstraint, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.addSoftConstraint(constraint);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function updateSoftConstraint(
	constraintId: string,
	updater: (constraint: SoftConstraint) => SoftConstraint,
	termOverrides?: Partial<TermConfig>
) {
	const store = await loadDesiredState(termOverrides);
	store.updateSoftConstraint(constraintId, updater);
	await saveDesiredState(store.snapshot, termOverrides);
}

export async function removeSoftConstraint(constraintId: string, termOverrides?: Partial<TermConfig>) {
	const store = await loadDesiredState(termOverrides);
	store.removeSoftConstraint(constraintId);
	await saveDesiredState(store.snapshot, termOverrides);
}
