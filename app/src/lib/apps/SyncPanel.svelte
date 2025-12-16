<svelte:options runes={false} />

<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import { datasetMeta } from '$lib/data/catalog/courseCatalog';
	import { termState, ensureTermStateLoaded, dispatchTermActionWithEffects } from '$lib/stores/termStateStore';
	import { githubToken, clearGithubToken } from '$lib/stores/githubAuth';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { translator } from '$lib/i18n';
	import type { TranslateFn } from '$lib/i18n';
	import { storageState, type StoragePreferencesSnapshot } from '$lib/stores/storageState';

	let gistId = '';
	let gistNote = '';
	let gistPublic = false;
	let gistStatus = '';
	let gistBusy = false;
	let storageSnapshot: StoragePreferencesSnapshot | null = null;
	let confirmOpen = false;
	let confirmBusy = false;
	let confirmError = '';

	let t: TranslateFn = (key) => key;
	$: t = $translator;
	$: storageSnapshot = $storageState;

	const format = (key: string, values?: Record<string, string | number>) => {
		let template = t(key);
		if (!values) return template;
		return Object.entries(values).reduce(
			(acc, [placeholder, value]) => acc.replace(`{${placeholder}}`, String(value)),
			template
		);
	};

	const hasGithubConfig = Boolean(import.meta.env?.PUBLIC_GITHUB_CLIENT_ID);

	$: void ensureTermStateLoaded();

	function startGithubLogin() {
		if (!hasGithubConfig) {
			gistStatus = t('panels.sync.githubMissing');
			return;
		}
		const width = 520;
		const height = 640;
		const left = window.screenX + (window.outerWidth - width) / 2;
		const top = window.screenY + (window.outerHeight - height) / 2;
		window.open(
			'/api/github/login',
			'github-login',
			`width=${width},height=${height},left=${left},top=${top}`
		);
	}

	onMount(() => {
		function handleMessage(event: MessageEvent) {
			if (event.origin !== window.location.origin) return;
			if (event.data?.type === 'github-token' && event.data.token) {
				githubToken.set(event.data.token);
				gistStatus = t('panels.sync.statuses.githubLoginSuccess');
			}
		}
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});

	function requireGithubToken() {
		const token = get(githubToken);
		if (!token) {
			gistStatus = t('panels.sync.statuses.requireLogin');
		}
		return token;
	}

	async function handleGistSync() {
		const token = requireGithubToken();
		if (!token) return;
		try {
			gistBusy = true;
			gistStatus = t('panels.sync.statuses.syncing');
			const state = $termState;
			if (!state) {
				gistStatus = t('panels.sync.statuses.termStateMissing');
				return;
			}

			const { result, effectsDone } = dispatchTermActionWithEffects({
				type: 'SYNC_GIST_EXPORT',
				token,
				gistId: gistId.trim() || undefined,
				note: gistNote.trim() || undefined,
				public: gistPublic
			});
			const dispatchResult = await result;
			if (!dispatchResult.ok) {
				gistStatus = format('panels.sync.statuses.syncFailed', { error: dispatchResult.error.message });
				return;
			}
			await effectsDone;
			const after = get(termState);
			const last = after?.history.entries
				.slice()
				.reverse()
				.find((entry) => entry.type === 'sync' && entry.id.startsWith('sync:export-'));
			const details = last?.details as Record<string, unknown> | undefined;
			if (last?.id.startsWith('sync:export-ok:') && details && typeof details.url === 'string') {
				gistStatus = format('panels.sync.statuses.syncSuccess', { url: details.url });
				if (!gistId.trim() && typeof details.gistId === 'string') gistId = details.gistId;
				return;
			}
			if (last?.id.startsWith('sync:export-err:') && details && typeof details.error === 'string') {
				gistStatus = format('panels.sync.statuses.syncFailed', { error: details.error });
				return;
			}
			gistStatus = t('panels.sync.statuses.syncDone');
		} catch (error) {
			gistStatus = format('panels.sync.statuses.syncFailed', {
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			gistBusy = false;
		}
	}

	async function handleGistImportConfirm() {
		const token = requireGithubToken();
		if (!token) return;
		const trimmed = gistId.trim();
		if (!trimmed) {
			gistStatus = t('panels.sync.statuses.gistIdRequired');
			return;
		}

		try {
			confirmBusy = true;
			confirmError = '';
			gistStatus = t('panels.sync.statuses.gistImporting');
			const { result, effectsDone } = dispatchTermActionWithEffects({
				type: 'SYNC_GIST_IMPORT_REPLACE',
				token,
				gistId: trimmed
			});
			const dispatchResult = await result;
			if (!dispatchResult.ok) {
				confirmError = dispatchResult.error.message;
				gistStatus = format('panels.sync.statuses.importFailed', { error: dispatchResult.error.message });
				return;
			}
			await effectsDone;
			const after = get(termState);
			const last = after?.history.entries
				.slice()
				.reverse()
				.find((entry) => entry.type === 'sync' && entry.id.startsWith('sync:import-'));
			const details = last?.details as Record<string, unknown> | undefined;
			if (last?.id.startsWith('sync:import-ok:')) {
				gistStatus = t('panels.sync.statuses.gistImportSuccess');
				confirmOpen = false;
				return;
			}
			if (last?.id.startsWith('sync:import-err:') && details && typeof details.error === 'string') {
				confirmError = details.error;
				gistStatus = format('panels.sync.statuses.importFailed', { error: details.error });
				return;
			}
			gistStatus = t('panels.sync.statuses.gistImportDone');
			confirmOpen = false;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			confirmError = msg;
			gistStatus = format('panels.sync.statuses.importFailed', { error: msg });
		} finally {
			confirmBusy = false;
		}
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.sync.title')}
		subtitle={format('panels.sync.currentTerm', { term: datasetMeta.semester ?? '' })}
		density="comfortable"
		enableStickyToggle={true}
	>
		<div class="flex flex-wrap items-start gap-5 min-w-0">
			{#if storageSnapshot}
				<section class="flex-[1_1_520px] min-w-[min(360px,100%)] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-4 shadow-[var(--app-shadow-soft)]">
					<h4 class="text-[var(--app-text-md)] font-semibold text-[var(--app-color-fg)]">{t('panels.sync.storageTitle')}</h4>
					<p class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.sync.storageDescription')}</p>
					<ul class="mt-3 list-disc pl-5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
						<li>{t('panels.sync.storageLanguage', { locale: storageSnapshot.locale })}</li>
						<li>{t('panels.sync.storageTheme', { theme: storageSnapshot.themeId })}</li>
						<li>
							{t('panels.sync.storagePagination', {
								mode:
									storageSnapshot.pagination.mode === 'paged' ? t('settings.paged') : t('settings.continuous'),
								size: storageSnapshot.pagination.pageSize,
								neighbors: storageSnapshot.pagination.pageNeighbors
							})}
						</li>
						<li>
							{t('panels.sync.storageSelectionMode', {
								mode:
									storageSnapshot.selectionMode === 'allowOverflowMode'
										? t('settings.allowOverflowMode')
										: t('settings.overflowSpeedRaceMode')
							})}
						</li>
						<li>
							{t('panels.sync.storageCrossCampus', {
								value: storageSnapshot.crossCampusAllowed ? t('dropdowns.enabled') : t('dropdowns.disabled')
							})}
						</li>
						<li>
							{t('panels.sync.storageCollapse', {
								value: storageSnapshot.collapseCoursesByName ? t('dropdowns.enabled') : t('dropdowns.disabled')
							})}
						</li>
						<li>
							{t('panels.sync.storageTimeTemplates', {
								count: storageSnapshot.timeTemplates.length
							})}
						</li>
					</ul>
				</section>
			{/if}

			<AppControlPanel
				title={t('panels.sync.gistTitle')}
				description={t('panels.sync.gistDescription')}
				density="comfortable"
				class="flex-[1_1_520px] min-w-[min(360px,100%)]"
			>
				<form class="flex flex-col gap-3" on:submit|preventDefault={handleGistSync}>
					{#if $githubToken}
						<div class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)] min-w-0">
							<span class="min-w-0 break-words [overflow-wrap:anywhere]">{t('panels.sync.gistLoggedIn')}</span>
							<AppButton variant="secondary" size="sm" on:click={clearGithubToken}>
								{t('panels.sync.logoutGithub')}
							</AppButton>
						</div>
					{:else}
						<AppButton type="button" variant="primary" size="sm" on:click={startGithubLogin}>
							{t('panels.sync.loginGithub')}
						</AppButton>
					{/if}
					<AppField label={t('panels.sync.gistIdLabel')}>
						<input
							class="w-full min-w-0 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
							type="text"
							placeholder={t('panels.sync.gistIdPlaceholder')}
							bind:value={gistId}
						/>
					</AppField>
					<AppField label={t('panels.sync.noteLabel')}>
						<input
							class="w-full min-w-0 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
							type="text"
							placeholder={t('panels.sync.notePlaceholder')}
							bind:value={gistNote}
						/>
					</AppField>
					<AppField label={t('panels.sync.publicLabel')}>
						<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							<input type="checkbox" bind:checked={gistPublic} />
							<span>{t('panels.sync.publicLabel')}</span>
						</label>
					</AppField>
					<AppButton type="submit" variant="primary" size="sm" disabled={gistBusy || !hasGithubConfig}>
						{gistBusy ? t('panels.sync.statuses.syncing') : t('panels.sync.uploadButton')}
					</AppButton>
					<AppButton
						type="button"
						variant="danger"
						size="sm"
						disabled={gistBusy || !hasGithubConfig || !$githubToken}
						on:click={() => (confirmOpen = true)}
					>
						{t('panels.sync.importReplaceButton')}
					</AppButton>
				</form>
				{#if gistStatus}
					<p class="mt-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{gistStatus}</p>
				{:else if !hasGithubConfig}
					<p class="mt-2 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{t('panels.sync.githubMissing')}</p>
				{/if}
			</AppControlPanel>
		</div>

		<AppDialog
			open={confirmOpen}
			title={t('panels.sync.confirm.importTitle')}
			on:close={() => {
				if (confirmBusy) return;
				confirmOpen = false;
				confirmError = '';
			}}
		>
			<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
				{format('panels.sync.confirm.importBody', { gistId: gistId.trim() || '-' })}
			</p>
			{#if confirmError}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{confirmError}</p>
			{/if}
			<div slot="actions" class="flex flex-wrap items-center justify-end gap-2">
				<AppButton variant="secondary" size="sm" on:click={() => (confirmOpen = false)} disabled={confirmBusy}>
					{t('panels.sync.confirm.cancel')}
				</AppButton>
				<AppButton variant="danger" size="sm" on:click={handleGistImportConfirm} loading={confirmBusy}>
					{t('panels.sync.confirm.importConfirm')}
				</AppButton>
			</div>
		</AppDialog>
	</ListSurface>
</DockPanelShell>
