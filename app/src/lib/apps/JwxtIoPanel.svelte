<svelte:options runes={false} />

	<script lang="ts">
		import { onDestroy, onMount } from 'svelte';
		import DockPanelShell from '$lib/components/DockPanelShell.svelte';
		import ListSurface from '$lib/components/ListSurface.svelte';
		import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
		import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppListCard from '$lib/components/AppListCard.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { requestWorkspacePanelFocus } from '$lib/utils/workspaceFocus';
	import { jwxtGetStatus, jwxtTaskList, jwxtTaskStop } from '$lib/data/jwxt/jwxtApi';
	import { jwxtPushPollingDesiredEnabled, setJwxtPushPollingDesiredEnabled } from '$lib/stores/jwxtPushPolling';
	import type { TaskSnapshot } from '../../../shared/jwxtCrawler/taskManager';
	import { clearJwxtIoLogs, jwxtIoLogs } from '$lib/stores/jwxtIoLog';
	import { termStatePersistStatus } from '$lib/stores/termStateStore';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let statusText = '';
	let statusOk = false;
	let tasks: TaskSnapshot[] = [];
	let refreshTimer: number | null = null;
	let refreshInFlight = false;
	let pollingPushRunning = false;
	let showOnlyPolling = true;
	let showOnlyErrors = false;

	function isPollingTask(task: TaskSnapshot) {
		return typeof task.kind === 'string' && task.kind.startsWith('jwxt_poll_');
	}

	function normalizeMs(value: unknown) {
		return typeof value === 'number' && Number.isFinite(value) ? value : null;
	}

	function formatDuration(ms: number) {
		const clamped = Math.max(0, Math.round(ms));
		if (clamped < 1000) return `${clamped}ms`;
		const secs = Math.round(clamped / 1000);
		if (secs < 60) return `${secs}s`;
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m}m${String(s).padStart(2, '0')}s`;
	}

	function formatTaskProgress(task: TaskSnapshot) {
		const stage = String(task.progress?.stage || '').trim();
		const done = typeof task.progress?.done === 'number' ? task.progress.done : null;
		const total = typeof task.progress?.total === 'number' ? task.progress.total : null;
		if (!stage) return '';
		return done != null && total != null ? `${stage} ${done}/${total}` : stage;
	}

	function summarizeTask(task: TaskSnapshot) {
		const progress = formatTaskProgress(task);
		const attempt = Number.isFinite(task.attempt) ? String(task.attempt) : '-';
		const delay = normalizeMs(task.nextDelayMs);
		const next = delay == null ? '-' : formatDuration(delay);
		const err = String(task.lastError || '').trim();
		return `${String(task.kind || '')} · ${String(task.state || '')} · #${attempt} · next=${next}${progress ? ` · ${progress}` : ''}${
			err ? ` · ${err}` : ''
		}`;
	}

	function formatTime(ms: number) {
		const d = new Date(ms);
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

		async function refreshOnce() {
		if (refreshInFlight) return;
		refreshInFlight = true;
		try {
			try {
				const st = await jwxtGetStatus();
				statusOk = Boolean(st.ok && st.supported);
				statusText = st.ok
					? st.loggedIn
						? t('panels.jwxtIo.status.loggedIn', { userId: st.account?.userId ?? '' })
						: t('panels.jwxtIo.status.notLoggedIn')
					: t('panels.jwxtIo.status.unavailable');
				} catch {
					statusOk = false;
					statusText = t('panels.jwxtIo.status.unavailable');
				}

				try {
					const list = await jwxtTaskList();
					tasks = list.ok ? list.tasks : [];
					pollingPushRunning = tasks.some((t) => t.kind === 'jwxt_poll_push' && t.state === 'running');
				} catch {
				tasks = [];
			}
			} finally {
				refreshInFlight = false;
			}
		}

		async function stopTask(taskId: string) {
			const task = tasks.find((t) => t.id === taskId) ?? null;
			if (task?.kind === 'jwxt_poll_push') setJwxtPushPollingDesiredEnabled(false);
			try {
				await jwxtTaskStop(taskId);
			} finally {
				await refreshOnce();
			}
		}

		async function copyTaskSummary(task: TaskSnapshot) {
			try {
				const text = summarizeTask(task);
				await navigator.clipboard.writeText(text);
			} catch {
				// ignore
			}
		}

		async function stopAllPolling() {
			if (tasks.some((t) => t.kind === 'jwxt_poll_push' && t.state === 'running')) setJwxtPushPollingDesiredEnabled(false);
			const targets = tasks.filter((task) => isPollingTask(task) && task.state === 'running');
			await Promise.allSettled(targets.map((task) => jwxtTaskStop(task.id)));
			await refreshOnce();
		}

		async function disablePollPush() {
			setJwxtPushPollingDesiredEnabled(false);
			const targets = tasks.filter((task) => task.kind === 'jwxt_poll_push' && task.state === 'running');
			await Promise.allSettled(targets.map((task) => jwxtTaskStop(task.id)));
			await refreshOnce();
		}

	onMount(() => {
		void refreshOnce();
		refreshTimer = window.setInterval(() => {
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
			void refreshOnce();
		}, 1500);
	});

	onDestroy(() => {
		if (refreshTimer) window.clearInterval(refreshTimer);
		refreshTimer = null;
	});

	$: taskCount = tasks.length;
	$: pollingRunningCount = tasks.filter((task) => isPollingTask(task) && task.state === 'running').length;
	$: pollPushDesiredState =
		$jwxtPushPollingDesiredEnabled === true
			? t('panels.jwxtIo.tasks.pollPushDesiredEnabled')
				: $jwxtPushPollingDesiredEnabled === false
					? t('panels.jwxtIo.tasks.pollPushDesiredDisabled')
					: t('panels.jwxtIo.tasks.pollPushDesiredUnknown');

	$: visibleTasks = tasks
		.filter((task) => (showOnlyPolling ? isPollingTask(task) : true))
		.filter((task) => (showOnlyErrors ? Boolean(task.lastError) : true))
		.slice()
		.sort((a, b) => {
			const ar = a.state === 'running' ? 0 : a.state === 'idle' ? 1 : a.state === 'error' ? 2 : 3;
			const br = b.state === 'running' ? 0 : b.state === 'idle' ? 1 : b.state === 'error' ? 2 : 3;
			if (ar !== br) return ar - br;
			return String(a.kind || '').localeCompare(String(b.kind || ''), 'en');
		});
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface title={t('panels.jwxtIo.title')} subtitle={t('panels.jwxtIo.description')} footerEnabled={false} enableStickyToggle={false}>
		<div class="flex flex-col gap-3">
			<AppControlPanel title={t('panels.jwxtIo.entry.title')} description={t('panels.jwxtIo.entry.description')} density="compact">
				<AppControlRow class="items-center">
					<AppButton size="sm" variant="secondary" on:click={() => requestWorkspacePanelFocus('jwxt')}>
						{t('panels.jwxtIo.openJwxtPanel')}
					</AppButton>
					<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxtIo.entry.hint')}</span>
				</AppControlRow>
			</AppControlPanel>

				<AppControlPanel title={t('panels.jwxtIo.runtime.title')} description={statusText} density="compact">
					<AppControlRow class="items-center">
						<span
							class={`text-[var(--app-text-xs)] ${statusOk ? 'text-[var(--app-color-success)]' : 'text-[var(--app-color-fg-muted)]'}`.trim()}
						>
							{t('panels.jwxtIo.runtime.updatedAt', { time: formatTime(Date.now()) })}
						</span>
						<div class="flex-1"></div>
						<AppButton size="sm" variant="secondary" on:click={() => void refreshOnce()}>{t('common.refresh')}</AppButton>
					</AppControlRow>
				</AppControlPanel>

				<AppControlPanel
					title={t('panels.jwxtIo.persistence.title')}
					description={t('panels.jwxtIo.persistence.description')}
					density="compact"
				>
					<AppControlRow class="items-center">
						<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('panels.jwxtIo.persistence.lastSaved', {
								time: $termStatePersistStatus.lastPersistedAt ? formatTime($termStatePersistStatus.lastPersistedAt) : '-'
							})}
						</span>
						{#if $termStatePersistStatus.pending}
							<span class="text-[11px] rounded px-1.5 py-0.5 bg-[var(--app-color-warning)]/15 text-[var(--app-color-warning)]">
								{t('panels.jwxtIo.persistence.pending')}
							</span>
						{/if}
					</AppControlRow>
					{#if $termStatePersistStatus.lastError}
						<div class="text-[var(--app-text-xs)] text-[var(--app-color-danger)] break-words [overflow-wrap:anywhere]">
							{t('panels.jwxtIo.persistence.error', { error: $termStatePersistStatus.lastError.slice(0, 300) })}
						</div>
					{/if}
				</AppControlPanel>

			<AppListCard title={t('panels.jwxtIo.tasks.title')} subtitle={t('panels.jwxtIo.tasks.subtitle')}>
				{#if tasks.length === 0}
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.jwxtIo.tasks.empty')}</p>
				{:else}
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<div class="flex flex-wrap items-center gap-3 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							<span>{t('panels.jwxtIo.tasks.pollingRunning', { count: pollingRunningCount })}</span>
							<span>{t('panels.jwxtIo.tasks.pollPushDesired', { state: pollPushDesiredState })}</span>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<label class="flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								<input type="checkbox" bind:checked={showOnlyPolling} />
								<span>{t('panels.jwxtIo.tasks.filterPollingOnly')}</span>
							</label>
							<label class="flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								<input type="checkbox" bind:checked={showOnlyErrors} />
								<span>{t('panels.jwxtIo.tasks.filterErrors')}</span>
							</label>
							<AppButton
								size="sm"
								variant="secondary"
								on:click={() => void disablePollPush()}
								disabled={$jwxtPushPollingDesiredEnabled === false && !pollingPushRunning}
							>
								{t('panels.jwxtIo.tasks.pollPushDisable')}
							</AppButton>
							<AppButton size="sm" variant="danger" on:click={() => void stopAllPolling()} disabled={pollingRunningCount === 0}>
								{t('panels.jwxtIo.tasks.stopAllPolling')}
							</AppButton>
						</div>
					</div>
					<div class="flex flex-col gap-2">
							{#each visibleTasks as task (task.id)}
								{@const delay = normalizeMs(task.nextDelayMs)}
								{@const progress = formatTaskProgress(task)}
								<div class="flex flex-wrap items-center gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] px-3 py-2">
									<div class="flex min-w-0 flex-1 flex-col gap-1">
										<div class="flex flex-wrap items-center gap-2 min-w-0">
											<span class="truncate text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{task.id}</span>
											<span
												class={`rounded px-1.5 py-0.5 text-[11px] ${
													task.state === 'running'
														? 'bg-[var(--app-color-success)]/15 text-[var(--app-color-success)]'
														: task.state === 'idle'
															? 'bg-[var(--app-color-warning)]/15 text-[var(--app-color-warning)]'
															: task.state === 'error'
																? 'bg-[var(--app-color-danger)]/15 text-[var(--app-color-danger)]'
																: 'bg-[var(--app-color-border-subtle)] text-[var(--app-color-fg-muted)]'
												}`.trim()}
											>
												{task.state}
											</span>
											<span class="truncate text-[var(--app-text-xs)] text-[var(--app-color-fg)]">{String(task.kind || '')}</span>
										</div>

										<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
											<span>attempt: {Number.isFinite(task.attempt) ? task.attempt : '-'}</span>
											<span>next: {delay == null ? '-' : formatDuration(delay)}</span>
											{#if progress}
												<span class="truncate">progress: {progress}</span>
											{/if}
											{#if task.parallel && typeof task.parallel.concurrency === 'number'}
												<span>{t('panels.jwxtIo.tasks.parallelLabel')} {task.parallel.concurrency}</span>
											{/if}
										</div>

										{#if task.lastError}
											<div class="text-[var(--app-text-xs)] text-[var(--app-color-danger)] break-words [overflow-wrap:anywhere]">
												{task.lastError}
											</div>
										{/if}
									</div>
								{#if isPollingTask(task)}
									<div class="flex items-center gap-2">
										<AppButton size="sm" variant="secondary" on:click={() => void copyTaskSummary(task)}>
											{t('panels.jwxtIo.tasks.copySummary')}
										</AppButton>
										<AppButton size="sm" variant="danger" on:click={() => void stopTask(task.id)} disabled={task.state !== 'running'}>
											{t('panels.jwxtIo.tasks.stop')}
										</AppButton>
									</div>
								{/if}
							</div>
						{/each}
				</div>
				{/if}
			</AppListCard>

			<AppListCard title={t('panels.jwxtIo.logs.title')} subtitle={t('panels.jwxtIo.logs.subtitle')}>
				<div class="flex items-center justify-between gap-2">
					<AppButton size="sm" variant="secondary" on:click={clearJwxtIoLogs}>{t('panels.jwxtIo.logs.clear')}</AppButton>
					<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
						{t('panels.jwxtIo.logs.count', { count: $jwxtIoLogs.length })}
					</span>
				</div>

				<div class="max-h-[320px] overflow-auto rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] p-2 text-[var(--app-text-xs)] [scrollbar-gutter:stable]">
					{#if $jwxtIoLogs.length === 0}
						<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxtIo.logs.empty')}</p>
					{:else}
						<ul class="m-0 list-none p-0 flex flex-col gap-1">
							{#each $jwxtIoLogs as row (row.id)}
								<li class="flex flex-wrap items-start gap-2">
									<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{formatTime(row.at)}</span>
									<span
										class={`text-[var(--app-text-xs)] ${
											row.level === 'error'
												? 'text-[var(--app-color-danger)]'
												: row.level === 'warn'
													? 'text-[var(--app-color-warn)]'
													: 'text-[var(--app-color-fg)]'
										}`.trim()}
									>
										{row.message}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</AppListCard>
		</div>
	</ListSurface>
</DockPanelShell>
