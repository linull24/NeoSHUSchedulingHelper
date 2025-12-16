import { applyManualUpdates, type ManualUpdate, type ManualUpdateResult } from './manualUpdates';
import { InsaneCourseData } from './InsaneCourseData';
import { encodeBase64 } from './utils/base64';
import { resolveTermId } from '../../config/term';

export interface ActionLogEntry {
	id: string;
	timestamp: number;
	termId: string;
	action: string;
	payload?: Record<string, unknown>;
	versionBase64?: string;
	undo?: ManualUpdate[];
	dockSessionId?: string;
	solverResultId?: string;
	defaultTarget?: SelectionTarget;
	overrideMode?: SolverOverrideMode;
	selectionSnapshotBase64?: string;
	revertedEntryId?: string;
}

export type SelectionTarget = 'selected' | 'wishlist';
export type SolverOverrideMode = 'merge' | 'replace-all';

type ActionLogAddPayload = Omit<ActionLogEntry, 'id' | 'timestamp' | 'termId'> & {
	termId?: string;
	timestamp?: number;
};

export class ActionLog {
	private entries: ActionLogEntry[] = [];
	private listeners: Array<(entries: ActionLogEntry[]) => void> = [];

	constructor(initialEntries: ActionLogEntry[] = []) {
		this.entries = initialEntries.map((entry) => normalizeEntry(entry));
	}

	add(entry: ActionLogAddPayload) {
		const timestamp = entry.timestamp ?? Date.now();
		const newEntry: ActionLogEntry = {
			id: generateId(),
			timestamp,
			termId: entry.termId ?? resolveTermId(),
			action: entry.action,
			payload: entry.payload,
			versionBase64: entry.versionBase64,
			undo: entry.undo,
			dockSessionId: entry.dockSessionId,
			solverResultId: entry.solverResultId,
			defaultTarget: entry.defaultTarget,
			overrideMode: entry.overrideMode,
			selectionSnapshotBase64: entry.selectionSnapshotBase64,
			revertedEntryId: entry.revertedEntryId
		};
		this.entries.push(newEntry);
		this.emit();
		return newEntry;
	}

	update(id: string, updater: (entry: ActionLogEntry) => ActionLogEntry) {
		const index = this.entries.findIndex((entry) => entry.id === id);
		if (index === -1) return null;
		const current = this.entries[index];
		const updated = normalizeEntry(updater(current));
		this.entries[index] = updated;
		this.emit();
		return updated;
	}

	getEntries(limit?: number) {
		if (!limit) return [...this.entries];
		return this.entries.slice(-limit);
	}

	clear() {
		this.entries = [];
		this.emit();
	}

	toJSON(): ActionLogEntry[] {
		return [...this.entries];
	}

	static fromJSON(entries: ActionLogEntry[]) {
		return new ActionLog(entries ?? []);
	}

	exportForGithub(note?: string) {
		const payload = {
			note,
			generatedAt: Date.now(),
			entries: this.entries.slice(-100)
		};
		const json = JSON.stringify(payload, null, 2);
		return { json, base64: encodeBase64(json) };
	}

	onChange(listener: (entries: ActionLogEntry[]) => void) {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((fn) => fn !== listener);
		};
	}

	private emit() {
		for (const listener of this.listeners) {
			listener(this.getEntries());
		}
	}
}

export interface ApplyUpdatesLogOptions {
	action?: string;
	payload?: Record<string, unknown>;
	termId?: string;
	dockSessionId?: string;
	solverResultId?: string;
	defaultTarget?: SelectionTarget;
	overrideMode?: SolverOverrideMode;
	selectionSnapshotBase64?: string;
	revertedEntryId?: string;
	versionBase64?: string;
}

export function applyManualUpdatesWithLog(
	data: InsaneCourseData,
	updates: ManualUpdate[],
	log: ActionLog,
	context?: Parameters<typeof applyManualUpdates>[2],
	logOptions?: ApplyUpdatesLogOptions
): ManualUpdateResult {
	const result = applyManualUpdates(data, updates, context);
	log.add({
		action: logOptions?.action ?? 'manual-update',
		payload: {
			applied: result.applied.length,
			skipped: result.skipped.length,
			...logOptions?.payload
		},
		versionBase64: logOptions?.versionBase64 ?? result.versionBase64,
		undo: updates,
		termId: logOptions?.termId,
		dockSessionId: logOptions?.dockSessionId,
		solverResultId: logOptions?.solverResultId,
		defaultTarget: logOptions?.defaultTarget,
		overrideMode: logOptions?.overrideMode,
		selectionSnapshotBase64: logOptions?.selectionSnapshotBase64,
		revertedEntryId: logOptions?.revertedEntryId
	});
	return result;
}

function generateId() {
	return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntry(entry: ActionLogEntry): ActionLogEntry {
	return {
		...entry,
		termId: entry.termId ?? resolveTermId()
	};
}
