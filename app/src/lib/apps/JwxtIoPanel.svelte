<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppListCard from '$lib/components/AppListCard.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { requestWorkspacePanelFocus } from '$lib/utils/workspaceFocus';
	import { jwxtGetStatus, jwxtTaskList, jwxtTaskStop, jwxtTaskUpdate } from '$lib/data/jwxt/jwxtApi';
	import type { TaskSnapshot } from '../../../shared/jwxtCrawler/taskManager';
	import { clearJwxtIoLogs, jwxtIoLogs } from '$lib/stores/jwxtIoLog';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let statusText = '';
	let statusOk = false;
	let tasks: TaskSnapshot[] = [];
	let refreshTimer: number | null = null;

	const concurrencyDraft = new Map<string, string>();
	let updateBusyId: string | null = null;
	let updateError = '';

	function formatTaskLine(task: TaskSnapshot) {
		const kind = String(task.kind || '');
		const state = String(task.state || '');
		const attempt = Number.isFinite(task.attempt) ? String(task.attempt) : '-';
		const delay = typeof task.nextDelayMs === 'number' ? `${task.nextDelayMs}ms` : '-';
		const stage = String(task.progress?.stage || '').trim();
		const done = typeof task.progress?.done === 'number' ? task.progress.done : null;
		const total = typeof task.progress?.total === 'number' ? task.progress.total : null;
		const progress = stage ? `${stage}${done != null && total != null ? ` ${done}/${total}` : ''}` : '';
		return `${kind} · ${state} · #${attempt} · next=${delay}${progress ? ` · ${progress}` : ''}`;
	}

	function formatTime(ms: number) {
		const d = new Date(ms);
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

	async function refreshOnce() {
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
		} catch {
			tasks = [];
		}
	}

	async function stopTask(taskId: string) {
		try {
			await jwxtTaskStop(taskId);
			await refreshOnce();
		} catch {
			// ignore
		}
	}

	async function updateParallel(task: TaskSnapshot, raw: string) {
		updateError = '';
		const n = Number.parseInt(String(raw || '').trim(), 10);
		const next = Number.isFinite(n) ? Math.max(1, Math.min(32, n)) : NaN;
		if (!Number.isFinite(next)) {
			updateError = t('panels.jwxtIo.tasks.invalidConcurrency');
			return;
		}
		try {
			updateBusyId = task.id;
			const res = await jwxtTaskUpdate(task.id, { parallel: { concurrency: next } });
			if (!res.ok) throw new Error(res.error);
			concurrencyDraft.set(task.id, String(next));
			await refreshOnce();
		} catch (e) {
			updateError = e instanceof Error ? e.message : String(e);
		} finally {
			updateBusyId = null;
		}
	}

	onMount(() => {
		void refreshOnce();
		refreshTimer = window.setInterval(() => void refreshOnce(), 800);
	});

	onDestroy(() => {
		if (refreshTimer) window.clearInterval(refreshTimer);
		refreshTimer = null;
	});

	$: taskCount = tasks.length;
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
				{#if updateError}
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{updateError}</p>
				{/if}
			</AppControlPanel>

			<AppListCard title={t('panels.jwxtIo.tasks.title')} subtitle={t('panels.jwxtIo.tasks.subtitle')}>
				{#if tasks.length === 0}
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.jwxtIo.tasks.empty')}</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each tasks as task (task.id)}
							<div class="flex flex-wrap items-center gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] px-3 py-2">
								<div class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{task.id}</span>
									<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg)] line-clamp-2">{formatTaskLine(task)}</span>
									{#if task.lastError}
										<span class="text-[var(--app-text-xs)] text-[var(--app-color-danger)] line-clamp-2">{task.lastError}</span>
									{/if}
									{#if task.parallel && typeof task.parallel.concurrency === 'number'}
										{@const controlId = `jwxt-io-parallel-${task.id}`}
										<div class="mt-1 flex flex-wrap items-center gap-2">
											<label for={controlId} class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{t('panels.jwxtIo.tasks.parallelLabel')}
											</label>
											<input
												id={controlId}
												class="w-20 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1 text-[var(--app-text-xs)]"
												value={concurrencyDraft.get(task.id) ?? String(task.parallel.concurrency)}
												on:input={(e) => concurrencyDraft.set(task.id, (e.currentTarget as HTMLInputElement).value)}
												type="number"
												min="1"
												max="32"
											/>
											<AppButton
												size="sm"
												variant="secondary"
												on:click={() => void updateParallel(task, concurrencyDraft.get(task.id) ?? String(task.parallel?.concurrency ?? ''))}
												loading={updateBusyId === task.id}
											>
												{t('panels.jwxtIo.tasks.applyConcurrency')}
											</AppButton>
										</div>
									{/if}
								</div>
								<AppButton size="sm" variant="danger" on:click={() => void stopTask(task.id)}>{t('panels.jwxtIo.tasks.stop')}</AppButton>
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
