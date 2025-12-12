<script lang="ts">
import DockPanelShell from '$lib/components/DockPanelShell.svelte';
import ListSurface from '$lib/components/ListSurface.svelte';
import { datasetMeta } from '$lib/data/catalog/courseCatalog';
import { encodeSelectionSnapshotBase64, importSelectionSnapshotBase64 } from '$lib/utils/selectionPersistence';
import { loadStateBundle } from '$lib/data/termState';
import { syncStateBundle } from '$lib/data/github/stateSync';
import { githubToken, clearGithubToken } from '$lib/stores/githubAuth';
import { get } from 'svelte/store';
import { onMount } from 'svelte';
import { translator } from '$lib/i18n';
import type { TranslateFn } from '$lib/i18n';
import { storageState, type StoragePreferencesSnapshot } from '$lib/stores/storageState';
import '$lib/styles/panels/sync-panel.scss';

	let exportStatus = '';
	let importStatus = '';
	let selectionBusy = false;
	let snapshotBase64 = '';
	let importBase64 = '';
	let gistId = '';
	let gistNote = '';
	let gistPublic = false;
	let gistStatus = '';
let gistBusy = false;
let storageSnapshot: StoragePreferencesSnapshot | null = null;

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

	async function generateSnapshot() {
		try {
			selectionBusy = true;
			snapshotBase64 = encodeSelectionSnapshotBase64();
			exportStatus = t('panels.sync.statuses.generated');
		} catch (error) {
			exportStatus = format('panels.sync.statuses.exportFailed', {
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			selectionBusy = false;
		}
	}

	function copySnapshot() {
		if (!snapshotBase64) return;
		navigator.clipboard?.writeText(snapshotBase64).then(
			() => {
				exportStatus = t('panels.sync.statuses.copySuccess');
			},
			() => {
				exportStatus = t('panels.sync.statuses.copyFailed');
			}
		);
	}

	async function handleImport() {
		if (!importBase64.trim()) {
			importStatus = t('panels.sync.statuses.importEmpty');
			return;
		}
		try {
			selectionBusy = true;
			const result = importSelectionSnapshotBase64(importBase64);
			importStatus = format('panels.sync.statuses.importSuccess', {
				selected: result.selectedApplied,
				wishlist: result.wishlistApplied
			});
			if (result.ignored.length) {
				importStatus += format('panels.sync.statuses.importIgnored', { count: result.ignored.length });
			}
		} catch (error) {
			importStatus = format('panels.sync.statuses.importFailed', {
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			selectionBusy = false;
		}
	}

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
			const bundle = await loadStateBundle();
			const result = await syncStateBundle(bundle, {
				token,
				gistId: gistId.trim() || undefined,
				note: gistNote.trim() || undefined,
				public: gistPublic
			});
			gistStatus = format('panels.sync.statuses.syncSuccess', { url: result.url });
			if (!gistId.trim()) {
				gistId = result.id;
			}
		} catch (error) {
			gistStatus = format('panels.sync.statuses.syncFailed', {
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			gistBusy = false;
		}
	}
</script>

<DockPanelShell>
<ListSurface
		title={t('panels.sync.title')}
		subtitle={format('panels.sync.currentTerm', { term: datasetMeta.semester ?? '' })}
		density="comfortable"
		enableStickyToggle={true}
	>
		<div class="sync-grid">
			{#if storageSnapshot}
				<div class="card">
					<h4>{t('panels.sync.storageTitle')}</h4>
					<p>{t('panels.sync.storageDescription')}</p>
					<ul class="storage-list">
						<li>
							{t('panels.sync.storageLanguage', { locale: storageSnapshot.locale })}
						</li>
						<li>
							{t('panels.sync.storageTheme', { theme: storageSnapshot.themeId })}
						</li>
						<li>
							{t('panels.sync.storagePagination', {
								mode:
									storageSnapshot.pagination.mode === 'paged'
										? t('settings.paged')
										: t('settings.continuous'),
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
				</div>
			{/if}
			<div class="card">
				<h4>{t('panels.sync.exportTitle')}</h4>
				<p>{t('panels.sync.exportDescription')}</p>
				<div class="stack">
					<textarea readonly placeholder={t('panels.sync.exportPlaceholder')} value={snapshotBase64} rows="5"></textarea>
					<div class="actions">
						<button class="primary" on:click={generateSnapshot} disabled={selectionBusy}>
							{t('panels.sync.exportButton')}
						</button>
						<button class="secondary" on:click={copySnapshot} disabled={!snapshotBase64}>
							{t('panels.sync.copyButton')}
						</button>
					</div>
				</div>
				{#if exportStatus}
					<p class="status">{exportStatus}</p>
				{/if}
			</div>
			<div class="card">
				<h4>{t('panels.sync.importTitle')}</h4>
				<p>{t('panels.sync.importDescription')}</p>
				<div class="stack">
					<textarea placeholder={t('panels.sync.importPlaceholder')} bind:value={importBase64} rows="5"></textarea>
					<button class="primary" on:click={handleImport} disabled={selectionBusy}>
						{t('panels.sync.importButton')}
					</button>
				</div>
				{#if importStatus}
					<p class="status">{importStatus}</p>
				{/if}
			</div>
			<div class="card gist-card">
				<h4>{t('panels.sync.gistTitle')}</h4>
				<p>{t('panels.sync.gistDescription')}</p>
				<form class="gist-form" on:submit|preventDefault={handleGistSync}>
					{#if $githubToken}
						<div class="login-state">
							<span>{t('panels.sync.gistLoggedIn')}</span>
							<button type="button" class="secondary" on:click={clearGithubToken}>
								{t('panels.sync.logoutGithub')}
							</button>
						</div>
					{:else}
						<button type="button" class="primary" on:click={startGithubLogin}>
							{t('panels.sync.loginGithub')}
						</button>
					{/if}
					<label class="form-group">
						<span>{t('panels.sync.gistIdLabel')}</span>
						<input
							type="text"
							placeholder={t('panels.sync.gistIdPlaceholder')}
							bind:value={gistId}
						/>
					</label>
					<label class="form-group">
						<span>{t('panels.sync.noteLabel')}</span>
						<input
							type="text"
							placeholder={t('panels.sync.notePlaceholder')}
							bind:value={gistNote}
						/>
					</label>
					<label class="toggle">
						<input type="checkbox" bind:checked={gistPublic} />
						<span>{t('panels.sync.publicLabel')}</span>
					</label>
					<button class="primary" type="submit" disabled={gistBusy || !hasGithubConfig}>
						{gistBusy ? t('panels.sync.statuses.syncing') : t('panels.sync.uploadButton')}
					</button>
				</form>
				{#if gistStatus}
					<p class="status">{gistStatus}</p>
				{:else if !hasGithubConfig}
					<p class="status">{t('panels.sync.githubMissing')}</p>
				{/if}
			</div>
		</div>
</ListSurface>
</DockPanelShell>
