<script lang="ts">
import { onMount } from 'svelte';
import DockPanelShell from '$lib/components/DockPanelShell.svelte';
import ListSurface from '$lib/components/ListSurface.svelte';
import type { ActionLogEntry, SelectionTarget, SolverOverrideMode } from '$lib/data/actionLog';
import { actionLogEntriesStore, ensureActionLogLoaded, appendActionLog } from '$lib/stores/actionLogStore';
import type { DesiredLock, SoftConstraint } from '$lib/data/desired/types';
import type { SolverRunMetrics } from '$lib/data/solver/resultTypes';
import { addDesiredLock, removeDesiredLock, addSoftConstraint, removeSoftConstraint, ensureDesiredStateLoaded } from '$lib/stores/desiredStateStore';
import { translator } from '$lib/i18n';
import type { TranslateFn } from '$lib/i18n';
import { importSelectionSnapshotBase64 } from '$lib/utils/selectionPersistence';
import '$lib/styles/panels/action-log-panel.scss';

let rollbacking = false;
let message = '';

let t: TranslateFn = (key) => key;
$: t = $translator;

	onMount(async () => {
		await Promise.all([ensureActionLogLoaded(), ensureDesiredStateLoaded()]);
	});

	function extractRollback(entry: ActionLogEntry) {
		const payload = entry.payload as ConstraintPayload | undefined;
		if (!payload || payload.kind !== 'constraint') return null;
		return payload.rollback ?? null;
	}

	async function handleRollback(entry: ActionLogEntry) {
		if (rollbacking) return;
		rollbacking = true;
		message = '';
		try {
			const rollback = extractRollback(entry);
			if (rollback) {
				await handleConstraintRollback(rollback);
				return;
			}
			if (entry.selectionSnapshotBase64) {
				await handleSelectionRestore(entry);
				return;
			}
		} catch (error) {
			message = error instanceof Error ? error.message : t('panels.actionLog.errors.rollback');
		} finally {
			rollbacking = false;
		}
	}

	async function handleConstraintRollback(rollback: ConstraintRollback) {
		switch (rollback.type) {
			case 'remove-lock':
				if (typeof rollback.lockId === 'string') {
					await removeDesiredLock(rollback.lockId);
					await appendActionLog({
						action: 'constraint:rollback',
						payload: { kind: 'rollback', scope: 'hard', target: rollback.lockId }
					});
				}
				break;
			case 'add-lock':
				if (rollback.lock) {
					await addDesiredLock(rollback.lock as DesiredLock);
					await appendActionLog({
						action: 'constraint:rollback',
						payload: { kind: 'rollback', scope: 'hard', target: rollback.lock.id }
					});
				}
				break;
			case 'remove-soft':
				if (typeof rollback.id === 'string') {
					await removeSoftConstraint(rollback.id);
					await appendActionLog({
						action: 'constraint:rollback',
						payload: { kind: 'rollback', scope: 'soft', target: rollback.id }
					});
				}
				break;
			case 'add-soft':
				if (rollback.constraint) {
					await addSoftConstraint(rollback.constraint as SoftConstraint);
					await appendActionLog({
						action: 'constraint:rollback',
						payload: { kind: 'rollback', scope: 'soft', target: rollback.constraint.id }
					});
				}
				break;
		}
	}

	async function handleSelectionRestore(entry: ActionLogEntry) {
		if (!entry.selectionSnapshotBase64) return;
		const result = importSelectionSnapshotBase64(entry.selectionSnapshotBase64);
		const solverPayload = extractSolverPayload(entry);
		const defaultTarget = entry.defaultTarget ?? solverPayload?.defaultTarget;
		const overrideMode = entry.overrideMode ?? solverPayload?.overrideMode;
		await appendActionLog({
			action: 'solver:undo',
			payload: {
				kind: 'solver-undo',
				solverResultId: entry.solverResultId,
				defaultTarget,
				overrideMode,
				planLength: solverPayload?.planLength
			},
			solverResultId: entry.solverResultId,
			dockSessionId: entry.dockSessionId,
			defaultTarget,
			overrideMode,
			selectionSnapshotBase64: entry.selectionSnapshotBase64,
			revertedEntryId: entry.id
		});
		message = replacePlaceholders(t('panels.actionLog.selectionRestored'), {
			selected: result.selectedApplied,
			wishlist: result.wishlistApplied
		});
		if (result.preferencesApplied) {
			message += ` ${t('panels.actionLog.preferencesRestored')}`;
		}
	}

	function extractSolverPayload(entry: ActionLogEntry) {
		const payload = entry.payload as ConstraintPayload | undefined;
		if (
			!payload ||
			(payload.kind !== 'solver-preview' &&
				payload.kind !== 'solver-apply' &&
				payload.kind !== 'solver-override' &&
				payload.kind !== 'solver-undo')
		) {
			return null;
		}
		return payload;
	}

	function canRollback(entry: ActionLogEntry) {
		return Boolean(extractRollback(entry) || entry.selectionSnapshotBase64);
	}

	const replacePlaceholders = (template: string, values: Record<string, string | number>) =>
		Object.entries(values).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), template);

	const resolveLockTypeLabel = (lock: DesiredLock) => {
		if (lock.type === 'course') return t('panels.solver.lockTypeOptions.course');
		if (lock.type === 'teacher') return t('panels.solver.lockTypeOptions.teacher');
		if (lock.type === 'time') return t('panels.solver.lockTypeOptions.time');
		return lock.type;
	};

const resolveConstraintTypeLabel = (constraint: SoftConstraint | undefined) => {
	if (!constraint?.type) return '';
	return t(`panels.solver.constraintTypeLabels.${constraint.type}`);
};

	const resolveTargetLabel = (target?: SelectionTarget) => {
		if (!target) return t('panels.actionLog.targets.unknown');
		return t(`panels.actionLog.targets.${target}`);
	};

const resolveOverrideModeLabel = (mode?: SolverOverrideMode) => {
	if (!mode) return '';
	return t(`panels.actionLog.override.${mode}`);
};

	function describeEntry(entry: ActionLogEntry) {
		const payload = entry.payload as ConstraintPayload | undefined;
		if (!payload) return entry.action;
		if (payload.kind === 'constraint') {
			const scope = t(`panels.actionLog.scope.${payload.scope}`);
			const action = t(`panels.actionLog.change.${payload.change}`);
			const base = `${scope} ${action}`;
			if (payload.lock) {
				return `${base} ${resolveLockTypeLabel(payload.lock)}`;
			}
			if (payload.constraint) {
				const label = resolveConstraintTypeLabel(payload.constraint);
				return label ? `${base} ${label}` : base;
			}
			return base;
		}
	if (payload.kind === 'solver-run') {
		const statusLabel = t(`panels.actionLog.solverStatus.${payload.status === 'sat' ? 'sat' : payload.status === 'unsat' ? 'unsat' : 'unknown'}`);
		return replacePlaceholders(t('panels.actionLog.describe.solverRun'), {
			status: statusLabel,
			plan: payload.planLength ?? 0
		});
	}
	if (payload.kind === 'solver-preview' || payload.kind === 'solver-apply' || payload.kind === 'solver-override' || payload.kind === 'solver-undo') {
		const target = resolveTargetLabel(payload.defaultTarget ?? entry.defaultTarget);
		if (payload.kind === 'solver-preview') {
			return replacePlaceholders(t('panels.actionLog.describe.solverPreview'), {
				plan: payload.planLength ?? 0,
				target
			});
		}
		if (payload.kind === 'solver-apply') {
			return replacePlaceholders(t('panels.actionLog.describe.solverApply'), {
				plan: payload.planLength ?? 0,
				target
			});
		}
		if (payload.kind === 'solver-override') {
			const modeLabel = resolveOverrideModeLabel(payload.overrideMode ?? entry.overrideMode);
			return replacePlaceholders(t('panels.actionLog.describe.solverOverride'), {
				plan: payload.planLength ?? 0,
				target,
				mode: modeLabel
			});
		}
		return replacePlaceholders(t('panels.actionLog.describe.solverUndo'), {
			target
		});
	}
	if (payload.kind === 'selection') {
		return describeSelectionEntry(payload);
	}
		if (payload.kind === 'rollback') {
			const scope = t(`panels.actionLog.scope.${payload.scope}`);
			return replacePlaceholders(t('panels.actionLog.describe.rollback'), { scope });
		}
		return entry.action;
	}

	type ConstraintRollback =
		| { type: 'remove-lock'; lockId?: string }
		| { type: 'add-lock'; lock?: DesiredLock }
		| { type: 'remove-soft'; id?: string }
		| { type: 'add-soft'; constraint?: SoftConstraint };

	type SelectionPayload = {
		kind: 'selection';
		change: SelectionChange;
		target: SelectionTarget;
		courseId?: string;
		courseTitle?: string;
		courseCode?: string;
		teacher?: string;
		fromWishlist?: boolean;
		movedFromSelected?: boolean;
		count?: number;
	};

	type SelectionChange =
		| 'select'
		| 'deselect'
		| 'move-to-wishlist'
		| 'wishlist-add'
		| 'wishlist-remove'
		| 'wishlist-clear';

	type ConstraintPayload =
		| {
				kind: 'constraint';
				scope: 'hard' | 'soft';
				change: 'add' | 'remove';
				lock?: DesiredLock;
				constraint?: SoftConstraint;
				rollback?: ConstraintRollback;
		  }
	| {
			kind: 'solver-run';
			status: string;
			planLength?: number;
			resultId?: string;
			metrics?: SolverRunMetrics;
			desiredSignature?: string;
			selectionSignature?: string;
			runType?: 'auto' | 'manual';
		}
	| {
			kind: 'solver-preview' | 'solver-apply' | 'solver-override' | 'solver-undo';
			solverResultId?: string;
			planLength?: number;
			defaultTarget?: SelectionTarget;
			overrideMode?: SolverOverrideMode;
			runType?: 'auto' | 'manual';
		}
	| {
			kind: 'rollback';
			scope: 'hard' | 'soft';
			target?: string;
		}
	| SelectionPayload;

	function describeSelectionEntry(payload: SelectionPayload) {
		const courseLabel = payload.courseTitle ?? payload.courseId ?? t('panels.actionLog.selection.unknownCourse');
		if (payload.change === 'select') {
			return replacePlaceholders(t('panels.actionLog.selection.select'), { course: courseLabel });
		}
		if (payload.change === 'deselect') {
			return replacePlaceholders(t('panels.actionLog.selection.deselect'), { course: courseLabel });
		}
		if (payload.change === 'move-to-wishlist') {
			return replacePlaceholders(t('panels.actionLog.selection.moveToWishlist'), { course: courseLabel });
		}
		if (payload.change === 'wishlist-add') {
			return replacePlaceholders(t('panels.actionLog.selection.wishlistAdd'), { course: courseLabel });
		}
		if (payload.change === 'wishlist-remove') {
			return replacePlaceholders(t('panels.actionLog.selection.wishlistRemove'), { course: courseLabel });
		}
		if (payload.change === 'wishlist-clear') {
			return replacePlaceholders(t('panels.actionLog.selection.wishlistClear'), {
				count: payload.count ?? 0
			});
		}
		return courseLabel;
	}
</script>

<DockPanelShell>
<ListSurface
	title={t('panels.actionLog.title')}
	subtitle={t('panels.actionLog.description')}
	count={$actionLogEntriesStore.length}
	density="comfortable"
>
	{#if message}
		<div class="error-banner">{message}</div>
	{/if}
	<div class="log-list">
		{#if !$actionLogEntriesStore.length}
			<p class="muted">{t('panels.actionLog.empty')}</p>
		{:else}
			{#each $actionLogEntriesStore.slice().reverse() as entry (entry.id)}
				<div class="log-entry">
					<div>
						<strong>{describeEntry(entry)}</strong>
						<div class="meta">
							<span>{new Date(entry.timestamp).toLocaleString()}</span>
							<span>{entry.action}</span>
						</div>
					</div>
				{#if canRollback(entry)}
					<button type="button" on:click={() => handleRollback(entry)} disabled={rollbacking}>
						{t('panels.actionLog.rollback')}
					</button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</ListSurface>
</DockPanelShell>
