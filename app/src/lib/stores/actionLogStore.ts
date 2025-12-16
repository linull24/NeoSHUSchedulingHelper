import { writable } from 'svelte/store';
import { ActionLog, type ActionLogEntry } from '../data/actionLog';
import { loadActionLog, saveActionLog } from '../data/stateRepository';

const entriesWritable = writable<ActionLogEntry[]>([]);
let actionLog: ActionLog | null = null;
let initPromise: Promise<void> | null = null;

export const actionLogEntriesStore = {
	subscribe: entriesWritable.subscribe
};

async function ensureLoaded() {
	if (actionLog) return actionLog;
	if (!initPromise) {
		initPromise = (async () => {
			actionLog = await loadActionLog();
			actionLog.onChange((entries) => {
				entriesWritable.set(entries);
			});
			entriesWritable.set(actionLog.getEntries());
		})();
	}
	await initPromise;
	return actionLog!;
}

export async function ensureActionLogLoaded() {
	await ensureLoaded();
}

export async function appendActionLog(
	entry: Omit<ActionLogEntry, 'id' | 'timestamp' | 'termId'> & { termId?: string; timestamp?: number }
) {
	const log = await ensureLoaded();
	log.add(entry);
	entriesWritable.set(log.getEntries());
	await saveActionLog(log);
}

export async function updateActionLogEntry(
	entryId: string,
	updater: (entry: ActionLogEntry) => ActionLogEntry
) {
	const log = await ensureLoaded();
	const updated = log.update(entryId, updater);
	if (!updated) return null;
	entriesWritable.set(log.getEntries());
	await saveActionLog(log);
	return updated;
}

export function getActionLogSnapshot() {
	return actionLog ? actionLog.getEntries() : [];
}
