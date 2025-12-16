<svelte:options runes={false} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import AppListCard from '$lib/components/AppListCard.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import {
		jwxtAutoPushMuteUntil,
		jwxtRememberedUserId
	} from '$lib/stores/jwxt';
	import { activateHover, clearHover } from '$lib/stores/courseHover';
	import {
		addToWishlist,
		deselectCourse,
		removeFromWishlist,
		selectCourse,
		selectedCourseIds,
		wishlistCourseIds
	} from '$lib/stores/courseSelection';
	import { courseCatalog, courseCatalogMap, type CourseCatalogEntry } from '$lib/data/catalog/courseCatalog';
	import { selectedEntryIds, termState, dispatchTermAction, ensureTermStateLoaded } from '$lib/stores/termStateStore';
	import {
		jwxtDrop,
		jwxtGetStatus,
		jwxtPing,
		jwxtLogin,
		jwxtLogout,
		jwxtSearch,
		type JwxtStatus,
		type JwxtSelectedPair
	} from '$lib/data/jwxt/jwxtApi';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let status: JwxtStatus | null = null;
	let statusMessage = '';

	let userId = '';
	let password = '';

	let loginBusy = false;
	let syncBusy = false;
	let pushBusy = false;
	let pushPreviewBusy = false;
	let lastSyncAt: Date | null = null;
	let lastPushAt: Date | null = null;
	let pushStatus = '';
	let pendingTtlMs: 0 | 120000 = 0;
	let lastRemoteDirtyDigest: string | null = null;

	let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
	let nowTick = Date.now();
	let autoSyncEnabled = false;
	let autoSyncIntervalSec = 120;
	let autoPushEnabled = false;

	let searchQuery = '';
	let searchBusy = false;
	let searchStatus = '';
	let searchResults: Array<{
		kchId: string;
		courseName: string;
		jxbId: string;
		teacher: string;
		time: string;
		credit: string;
	}> = [];
	let remoteSelected: JwxtSelectedPair[] = [];

	let confirmOpen = false;
	let confirmTitle = '';
	let confirmBody = '';
	let confirmConfirmLabel = '';
	let confirmVariant: 'primary' | 'danger' = 'primary';
	let confirmBusy = false;
	let confirmError = '';
	let confirmAction: (() => Promise<void>) | null = null;
	let confirmSections: Array<{ title: string; items: string[] }> = [];
	let confirmKind: 'default' | 'jwxt-push' = 'default';

	const inputClass =
		'w-full min-w-0 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]';

	$: userId = $jwxtRememberedUserId;
	$: autoSyncEnabled = $termState?.settings.jwxt.autoSyncEnabled ?? false;
	$: autoSyncIntervalSec = $termState?.settings.jwxt.autoSyncIntervalSec ?? 120;
	$: autoPushEnabled = $termState?.settings.jwxt.autoPushEnabled ?? false;

	const format = (key: string, values?: Record<string, string | number>) => {
		let template = t(key);
		if (!values) return template;
		return Object.entries(values).reduce(
			(acc, [placeholder, value]) => acc.replace(`{${placeholder}}`, String(value)),
			template
		);
	};

	const jwxtIndex: Record<string, string> = Object.create(null);
	const jwxtIndexBySectionId: Record<string, string> = Object.create(null);
	for (const entry of courseCatalog) {
		jwxtIndex[`${entry.courseCode}::${entry.sectionId}`] = entry.id;
		if (!jwxtIndexBySectionId[entry.sectionId]) jwxtIndexBySectionId[entry.sectionId] = entry.id;
	}

	function mapRemotePairsToLocalIds(pairs: JwxtSelectedPair[]) {
		const ids: string[] = [];
		for (const pair of pairs) {
			const id = jwxtIndex[`${pair.kchId}::${pair.jxbId}`] || jwxtIndexBySectionId[pair.jxbId];
			if (id) ids.push(id);
		}
		return ids;
	}

	function mapRemotePairToLocalId(pair: { kchId: string; jxbId: string }) {
		return jwxtIndex[`${pair.kchId}::${pair.jxbId}`] || jwxtIndexBySectionId[pair.jxbId] || '';
	}

	function describeCourse(entry: CourseCatalogEntry) {
		const parts = [entry.title];
		if (entry.teacher) parts.push(entry.teacher);
		if (entry.slot) parts.push(entry.slot);
		const meta: string[] = [];
		if (entry.courseCode) meta.push(entry.courseCode);
		if (entry.sectionId) meta.push(entry.sectionId);
		if (meta.length) parts.push(meta.join(' · '));
		return parts.join(' · ');
	}

	function handleHover(entry: CourseCatalogEntry, source: 'candidate' | 'selected' | 'list') {
		activateHover({
			id: entry.id,
			title: entry.title,
			location: entry.location,
			slot: entry.slot,
			weekSpan: entry.weekSpan,
			weekParity: entry.weekParity,
			source
		});
	}

	function handleLeave(source: 'candidate' | 'selected' | 'list') {
		clearHover(source);
	}

	function setStatusMessage(key: string, params?: Record<string, string | number>) {
		statusMessage = params ? t(key, params) : t(key);
	}

	function renderApiError(error: unknown) {
		if (typeof error === 'string') return error;
		return error instanceof Error ? error.message : String(error);
	}

	async function updateJwxtSettings(patch: Partial<NonNullable<typeof $termState>['settings']['jwxt']>) {
		if (!$termState) return;
		const next = { ...$termState.settings.jwxt, ...patch };
		const result = await dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { jwxt: next } });
		if (!result.ok) {
			statusMessage = result.error.message;
		}
	}

	function confirmRemoteDrop(pair: { kchId: string; jxbId: string; label: string }) {
		requestConfirm({
			title: t('panels.jwxt.confirm.dropTitle'),
			body: format('panels.jwxt.confirm.dropBody', { course: pair.label }),
			confirmLabel: t('panels.jwxt.confirm.dropConfirm'),
			variant: 'danger',
			action: async () => {
				const result = await dispatchTermAction({ type: 'JWXT_DROP_NOW', pair: { kchId: pair.kchId, jxbId: pair.jxbId } });
				if (!result.ok) throw new Error(result.error.message);
				setStatusMessage('panels.jwxt.statuses.dropSuccess');
			}
		});
	}

	async function refreshStatus() {
		const response = await jwxtGetStatus();
		if (!response.ok) {
			status = {
				supported: false,
				loggedIn: false,
				message: response.error
			};
			setStatusMessage('panels.jwxt.statuses.statusFailed', { error: response.error });
			return;
		}
		status = response;
		if (!response.supported) {
			setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		setStatusMessage(response.loggedIn ? 'panels.jwxt.statuses.loggedIn' : 'panels.jwxt.statuses.loggedOut');
	}

	async function handlePing() {
		try {
			setStatusMessage('panels.jwxt.statuses.pinging');
			const response = await jwxtPing();
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.pingFailed', { error: response.error });
				return;
			}
			setStatusMessage('panels.jwxt.statuses.pingOk', { status: response.ssoEntryStatus });
		} catch (error) {
			setStatusMessage('panels.jwxt.statuses.pingFailed', { error: renderApiError(error) });
		}
	}

	onMount(() => {
		void ensureTermStateLoaded();
		void refreshStatus();
		if (!browser) return;
		const nowTimer = setInterval(() => (nowTick = Date.now()), 1000);
		return () => clearInterval(nowTimer);
	});

	onDestroy(() => {
		if (autoSyncTimer) {
			clearInterval(autoSyncTimer);
			autoSyncTimer = null;
		}
	});

	function stopAutoSyncTimer() {
		if (autoSyncTimer) {
			clearInterval(autoSyncTimer);
			autoSyncTimer = null;
		}
	}

	function startAutoSyncTimer(intervalSec: number) {
		stopAutoSyncTimer();
		autoSyncTimer = setInterval(() => {
			void handleSync({ silent: true });
		}, Math.max(30, intervalSec) * 1000);
	}

	$: if (browser) {
		if (autoSyncEnabled && status?.loggedIn && status?.supported) {
			startAutoSyncTimer(autoSyncIntervalSec);
		} else {
			stopAutoSyncTimer();
		}
	}

	$: muteActive = browser && $jwxtAutoPushMuteUntil > nowTick;

	async function handleLogin() {
		if (!userId.trim() || !password) {
			setStatusMessage('panels.jwxt.statuses.missingCredentials');
			return;
		}
		try {
			loginBusy = true;
			setStatusMessage('panels.jwxt.statuses.loggingIn');
			const response = await jwxtLogin({ userId: userId.trim(), password });
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.loginFailed', { error: response.error });
				return;
			}
			status = response;
			password = '';
			setStatusMessage('panels.jwxt.statuses.loginSuccess');
			void handleSync();
		} finally {
			loginBusy = false;
		}
	}

	async function handleLogout() {
		try {
			loginBusy = true;
			const response = await jwxtLogout();
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.logoutFailed', { error: response.error });
				return;
			}
			status = response;
			setStatusMessage('panels.jwxt.statuses.loggedOut');
			remoteSelected = [];
		} finally {
			loginBusy = false;
		}
	}

	async function handleSync(options?: { silent?: boolean }) {
		if (!status?.supported) {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.requireLogin');
			return;
		}
		syncBusy = true;
		if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncing');
		const result = await dispatchTermAction({ type: 'JWXT_PULL_REMOTE' });
		syncBusy = false;
		if (!result.ok) {
			if (!options?.silent) {
				setStatusMessage('panels.jwxt.statuses.syncFailed', { error: result.error.message });
			}
			return;
		}
		lastSyncAt = new Date();
		if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncSuccess', { selected: 0, wishlist: 0 });
	}

	function requestConfirm(config: {
		title: string;
		body: string;
		confirmLabel: string;
		variant?: 'primary' | 'danger';
		sections?: Array<{ title: string; items: string[] }>;
		kind?: 'default' | 'jwxt-push';
		action: () => Promise<void>;
	}) {
		confirmTitle = config.title;
		confirmBody = config.body;
		confirmConfirmLabel = config.confirmLabel;
		confirmVariant = config.variant ?? 'primary';
		confirmSections = config.sections ?? [];
		confirmKind = config.kind ?? 'default';
		confirmAction = config.action;
		confirmError = '';
		confirmOpen = true;
	}

	async function runConfirmedAction() {
		if (!confirmAction) return;
		try {
			confirmBusy = true;
			await confirmAction();
			confirmOpen = false;
			confirmAction = null;
		} catch (error) {
			confirmError = renderApiError(error);
		} finally {
			confirmBusy = false;
		}
	}

	function limitList(items: string[], max = 20) {
		if (items.length <= max) return { items, more: 0 };
		return { items: items.slice(0, max), more: items.length - max };
	}

	function buildSelectedPairs() {
		const ids = Array.from(get(selectedEntryIds));
		return ids
			.map((id) => courseCatalogMap.get(id))
			.filter(Boolean)
			.map((entry) => ({ kchId: entry!.courseCode, jxbId: entry!.sectionId })) as JwxtSelectedPair[];
	}

	function computeDiff(remote: JwxtSelectedPair[], desired: JwxtSelectedPair[]) {
		const key = (pair: JwxtSelectedPair) => `${pair.kchId}::${pair.jxbId}`;
		const remoteSet = new Set(remote.map(key));
		const desiredSet = new Set(desired.map(key));
		return {
			toEnroll: desired.filter((pair) => !remoteSet.has(key(pair))),
			toDrop: remote.filter((pair) => !desiredSet.has(key(pair)))
		};
	}

	function describePair(pair: JwxtSelectedPair) {
		const id = mapRemotePairToLocalId(pair);
		const entry = id ? courseCatalogMap.get(id) : null;
		if (!entry) return `${pair.kchId} · ${pair.jxbId}`;
		return describeCourse(entry);
	}

	async function handlePreviewClick() {
		if (!status?.supported) {
			setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			setStatusMessage('panels.jwxt.statuses.requireLogin');
			return;
		}

		const snapshot = get(termState);
		const remote = snapshot?.jwxt.remoteSnapshot?.pairs ?? [];
		const desired = buildSelectedPairs();
		const diff = computeDiff(remote, desired);
		const enroll = diff.toEnroll.map(describePair);
		const drop = diff.toDrop.map(describePair);
		const enrollLimited = limitList(enroll);
		const dropLimited = limitList(drop);
		const enrollItems =
			enrollLimited.more > 0
				? [...enrollLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: enrollLimited.more })]
				: enrollLimited.items;
		const dropItems =
			dropLimited.more > 0
				? [...dropLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: dropLimited.more })]
				: dropLimited.items;
		pendingTtlMs = 0;
		requestConfirm({
			title: t('panels.jwxt.confirm.pushTitle'),
			body: format('panels.jwxt.confirm.pushPreviewBody', {
				enroll: diff.toEnroll.length,
				drop: diff.toDrop.length
			}),
			confirmLabel: t('panels.jwxt.confirm.pushConfirm'),
			variant: diff.toEnroll.length || diff.toDrop.length ? 'danger' : 'primary',
			kind: 'jwxt-push',
			sections: [
				{ title: t('panels.jwxt.confirm.pushDiffEnrollTitle'), items: enrollItems },
				{ title: t('panels.jwxt.confirm.pushDiffDropTitle'), items: dropItems }
			],
			action: async () => {
				pushBusy = true;
				try {
					const preview = await dispatchTermAction({ type: 'JWXT_PREVIEW_PUSH', ttlMs: pendingTtlMs });
					if (!preview.ok) throw new Error(preview.error.message);
					const pushed = await dispatchTermAction({ type: 'JWXT_CONFIRM_PUSH' });
					if (!pushed.ok) throw new Error(pushed.error.message);
					lastPushAt = new Date();
					setStatusMessage('panels.jwxt.statuses.pushing');
				} finally {
					pushBusy = false;
				}
			}
		});
	}

	async function handleConfirmPush() {
		const result = await dispatchTermAction({ type: 'JWXT_CONFIRM_PUSH' });
		if (!result.ok) {
			setStatusMessage('panels.jwxt.statuses.pushFailed', { error: result.error.message });
			return;
		}
		lastPushAt = new Date();
		setStatusMessage('panels.jwxt.statuses.pushing');
	}

	async function handleSearch() {
		if (!status?.supported) {
			searchStatus = t('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			searchStatus = t('panels.jwxt.statuses.requireLogin');
			return;
		}
		if (!searchQuery.trim()) {
			searchStatus = t('panels.jwxt.statuses.searchEmpty');
			return;
		}
		try {
			searchBusy = true;
			searchStatus = t('panels.jwxt.statuses.searching');
			const response = await jwxtSearch({ query: searchQuery.trim() });
			if (!response.ok) {
				searchStatus = t('panels.jwxt.statuses.searchFailed', { error: response.error });
				return;
			}
			searchResults = response.results;
			searchStatus = format('panels.jwxt.statuses.searchSuccess', { count: response.results.length });
		} finally {
			searchBusy = false;
		}
	}

	$: {
		const snapshot = $termState;
		remoteSelected = (snapshot?.jwxt.remoteSnapshot?.pairs ?? []) as JwxtSelectedPair[];
		const digest = snapshot?.jwxt.remoteSnapshot?.digest ?? null;
		if (snapshot?.jwxt.syncState === 'REMOTE_DIRTY' && digest && digest !== lastRemoteDirtyDigest) {
			lastRemoteDirtyDigest = digest;
			requestConfirm({
				title: t('panels.jwxt.confirm.pushTitle'),
				body: t('panels.jwxt.confirm.remoteChangedBody'),
				confirmLabel: t('panels.jwxt.confirm.pushConfirm'),
				variant: 'danger',
				kind: 'jwxt-push',
				sections: [
					{
						title: t('panels.jwxt.confirm.pushDiffEnrollTitle'),
						items: (snapshot.jwxt.pushTicket?.diff.toEnroll ?? []).map(describePair)
					},
					{
						title: t('panels.jwxt.confirm.pushDiffDropTitle'),
						items: (snapshot.jwxt.pushTicket?.diff.toDrop ?? []).map(describePair)
					}
				],
				action: async () => {
					pushBusy = true;
					try {
						const preview = await dispatchTermAction({ type: 'JWXT_PREVIEW_PUSH', ttlMs: pendingTtlMs });
						if (!preview.ok) throw new Error(preview.error.message);
						const pushed = await dispatchTermAction({ type: 'JWXT_CONFIRM_PUSH' });
						if (!pushed.ok) throw new Error(pushed.error.message);
						lastPushAt = new Date();
						setStatusMessage('panels.jwxt.statuses.pushing');
					} finally {
						pushBusy = false;
					}
				}
			});
		}
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface title={t('panels.jwxt.title')} subtitle={t('panels.jwxt.subtitle')} density="comfortable">
		<div class="flex flex-wrap items-start gap-5 min-w-0">
			<AppControlPanel
				title={t('panels.jwxt.connectionTitle')}
				description={t('panels.jwxt.connectionDescription')}
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<div class="flex flex-col gap-3">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex flex-col gap-1 min-w-[240px] flex-1">
							<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								{statusMessage || t('panels.jwxt.statuses.loading')}
							</p>
							{#if status?.account?.userId}
								<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{format('panels.jwxt.statuses.accountLabel', { userId: status.account.userId })}
								</p>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<AppButton variant="secondary" size="sm" on:click={refreshStatus} disabled={loginBusy}>
								{t('panels.jwxt.refresh')}
							</AppButton>
							<AppButton variant="secondary" size="sm" on:click={handlePing} disabled={loginBusy}>
								{t('panels.jwxt.ping')}
							</AppButton>
							{#if status?.loggedIn}
								<AppButton variant="secondary" size="sm" on:click={handleLogout} disabled={loginBusy}>
									{t('panels.jwxt.logout')}
								</AppButton>
							{/if}
						</div>
					</div>

					{#if !status?.loggedIn}
						<form class="flex flex-col gap-3" on:submit|preventDefault={handleLogin}>
							<div class="flex flex-col gap-3">
								<AppField label={t('panels.jwxt.userIdLabel')}>
									<input class={inputClass} type="text" autocomplete="username" bind:value={$jwxtRememberedUserId} />
								</AppField>
								<AppField label={t('panels.jwxt.passwordLabel')}>
									<input class={inputClass} type="password" autocomplete="current-password" bind:value={password} />
								</AppField>
							</div>
							<AppControlRow>
								<AppButton buttonType="submit" variant="primary" size="sm" disabled={loginBusy}>
									{loginBusy ? t('panels.jwxt.statuses.loggingIn') : t('panels.jwxt.login')}
								</AppButton>
								<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{t('panels.jwxt.loginHint')}
								</span>
							</AppControlRow>
						</form>
					{/if}
				</div>
			</AppControlPanel>

			<AppControlPanel
				title={t('panels.jwxt.syncTitle')}
				description={t('panels.jwxt.syncDescription')}
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<div class="flex flex-wrap items-center gap-3">
					<AppButton variant="primary" size="sm" on:click={() => handleSync()} disabled={syncBusy || !status?.loggedIn}>
						{syncBusy ? t('panels.jwxt.statuses.syncing') : t('panels.jwxt.syncFrom')}
					</AppButton>
					<AppButton
						variant="danger"
						size="sm"
						on:click={handlePreviewClick}
						disabled={pushBusy || pushPreviewBusy || !status?.loggedIn || !$termState?.jwxt.remoteSnapshot}
					>
						{pushBusy || pushPreviewBusy ? t('panels.jwxt.statuses.pushing') : t('panels.jwxt.pushTo')}
						</AppButton>
						<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							<input
								type="checkbox"
								checked={autoSyncEnabled}
								on:change={(event) =>
									void updateJwxtSettings({
										autoSyncEnabled: (event.currentTarget as HTMLInputElement).checked
									})}
								disabled={!status?.loggedIn || !$termState}
							/>
							<span>{t('panels.jwxt.autoSync')}</span>
						</label>
						<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							<input
								type="checkbox"
								checked={autoPushEnabled}
								on:change={(event) =>
									void updateJwxtSettings({
										autoPushEnabled: (event.currentTarget as HTMLInputElement).checked
									})}
								disabled={!status?.loggedIn || !$termState}
							/>
							<span>{t('panels.jwxt.autoPush')}</span>
						</label>
						<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							<span class="text-[var(--app-color-fg-muted)]">{t('panels.jwxt.autoSyncInterval')}</span>
							<select
								class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2.5 py-1.5 text-[var(--app-text-sm)]"
								value={autoSyncIntervalSec}
								on:change={(event) => {
									const raw = Number((event.currentTarget as HTMLSelectElement).value);
									const next = Number.isFinite(raw) ? Math.max(30, Math.round(raw)) : 120;
									void updateJwxtSettings({ autoSyncIntervalSec: next });
								}}
								disabled={!autoSyncEnabled || !$termState}
							>
								<option value={60}>60s</option>
								<option value={120}>120s</option>
								<option value={300}>300s</option>
								<option value={600}>600s</option>
						</select>
					</label>
				</div>
				<div class="mt-2 flex flex-col gap-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
					<p class="m-0">{format('panels.jwxt.localCounts', { selected: $selectedCourseIds.size, wishlist: $wishlistCourseIds.size })}</p>
					{#if lastSyncAt}
						<p class="m-0">{format('panels.jwxt.lastSyncAt', { time: lastSyncAt.toLocaleString() })}</p>
					{/if}
					{#if lastPushAt}
						<p class="m-0">{format('panels.jwxt.lastPushAt', { time: lastPushAt.toLocaleString() })}</p>
					{/if}
						{#if pushStatus}
							<p class="m-0">{pushStatus}</p>
						{/if}
						{#if autoPushEnabled}
							{#if muteActive}
								<p class="m-0">{format('panels.jwxt.autoPushMutedUntil', { time: new Date($jwxtAutoPushMuteUntil).toLocaleTimeString() })}</p>
							{:else}
								<p class="m-0">{t('panels.jwxt.autoPushHint')}</p>
							{/if}
						{/if}
					<p class="m-0">{t('panels.jwxt.confirmHint')}</p>
				</div>
			</AppControlPanel>

			<AppControlPanel
				title={t('panels.jwxt.enrollTitle')}
				description={t('panels.jwxt.enrollDescription')}
				class="flex-[2_1_720px] min-w-[min(360px,100%)] max-w-[1200px]"
			>
				<form class="flex flex-col gap-3" on:submit|preventDefault={handleSearch}>
					<AppField label={t('panels.jwxt.searchLabel')}>
						<input class={inputClass} type="text" placeholder={t('panels.jwxt.searchPlaceholder')} bind:value={searchQuery} />
					</AppField>
					<AppControlRow>
						<AppButton buttonType="submit" variant="secondary" size="sm" disabled={searchBusy || !status?.loggedIn}>
							{searchBusy ? t('panels.jwxt.statuses.searching') : t('panels.jwxt.search')}
						</AppButton>
					</AppControlRow>
					{#if searchStatus}
						<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{searchStatus}</p>
					{/if}
				</form>

				{#if searchResults.length}
					<div class="mt-3 flex flex-col gap-2">
						{#each searchResults as row (row.kchId + ':' + row.jxbId)}
							{@const localId = mapRemotePairToLocalId({ kchId: row.kchId, jxbId: row.jxbId })}
							{@const entry = localId ? courseCatalogMap.get(localId) : null}
							{#if entry}
								<CourseCard
									id={entry.id}
									title={entry.title}
									teacher={entry.teacher}
									time={entry.slot ?? t('courseCard.noTime')}
									courseCode={entry.courseCode}
									credit={entry.credit ?? null}
									status={entry.status}
									capacity={entry.capacity}
									vacancy={entry.vacancy}
									colorSeed={entry.id}
									specialTags={entry.specialTags}
									onHover={() => handleHover(entry, 'list')}
									onLeave={() => handleLeave('list')}
								>
									<CardActionBar slot="actions" class="justify-start">
										{#if $selectedCourseIds.has(entry.id)}
											<AppButton variant="secondary" size="sm" on:click={() => deselectCourse(entry.id)}>
												{t('panels.jwxt.planDeselect')}
											</AppButton>
										{:else}
											<AppButton variant="primary" size="sm" on:click={() => selectCourse(entry.id)}>
												{t('panels.jwxt.planSelect')}
											</AppButton>
											<AppButton
												variant="secondary"
												size="sm"
												on:click={() => ($wishlistCourseIds.has(entry.id) ? removeFromWishlist(entry.id) : addToWishlist(entry.id))}
											>
												{$wishlistCourseIds.has(entry.id) ? t('panels.jwxt.planWishlistRemove') : t('panels.jwxt.planWishlistAdd')}
											</AppButton>
										{/if}
									</CardActionBar>
								</CourseCard>
							{:else}
								<AppListCard title={row.courseName || row.kchId} subtitle={`${row.teacher} · ${row.kchId} · ${row.jxbId}`}>
									{#if row.time}
										<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)] break-words [overflow-wrap:anywhere]">
											{row.time}
										</p>
									{/if}
									<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-warning)]">
										{t('panels.jwxt.planUnavailableHint')}
									</p>
									<CardActionBar slot="actions" class="justify-start">
										<AppButton variant="secondary" size="sm" disabled>
											{t('panels.jwxt.planUnavailable')}
										</AppButton>
									</CardActionBar>
								</AppListCard>
							{/if}
						{/each}
					</div>
				{/if}
			</AppControlPanel>

			{#if remoteSelected.length}
				<AppControlPanel
					title={t('panels.jwxt.remoteSelectedTitle')}
					description={t('panels.jwxt.remoteSelectedDescription')}
					class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
				>
					<div class="flex flex-col gap-2">
						{#each remoteSelected as item (item.kchId + ':' + item.jxbId)}
							{@const localId = mapRemotePairToLocalId(item)}
							{@const entry = localId ? courseCatalogMap.get(localId) : null}
							{#if entry}
								<CourseCard
									id={entry.id}
									title={entry.title}
									teacher={entry.teacher}
									time={entry.slot ?? t('courseCard.noTime')}
									courseCode={entry.courseCode}
									credit={entry.credit ?? null}
									status={entry.status}
									capacity={entry.capacity}
									vacancy={entry.vacancy}
									colorSeed={entry.id}
									specialTags={entry.specialTags}
									onHover={() => handleHover(entry, 'selected')}
									onLeave={() => handleLeave('selected')}
								>
									<CardActionBar slot="actions" class="justify-start">
										<AppButton
											variant="secondary"
											size="sm"
											on:click={() => deselectCourse(entry.id)}
											disabled={!$selectedCourseIds.has(entry.id)}
										>
											{t('panels.jwxt.planDrop')}
										</AppButton>
										<AppButton
											variant="danger"
											size="sm"
											on:click={() =>
												confirmRemoteDrop({
													kchId: item.kchId,
													jxbId: item.jxbId,
													label: describeCourse(entry)
												})}
											disabled={!status?.loggedIn}
										>
											{t('panels.jwxt.dropNow')}
										</AppButton>
									</CardActionBar>
								</CourseCard>
							{:else}
								<AppListCard title={`${item.kchId} · ${item.jxbId}`} subtitle={t('panels.jwxt.remoteSelectedNoMapping')}>
									<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-warning)]">
										{t('panels.jwxt.planUnavailableHint')}
									</p>
									<CardActionBar slot="actions" class="justify-start">
										<AppButton
											variant="danger"
											size="sm"
											on:click={() =>
												confirmRemoteDrop({
													kchId: item.kchId,
													jxbId: item.jxbId,
													label: `${item.kchId} (${item.jxbId})`
												})}
											disabled={!status?.loggedIn}
										>
											{t('panels.jwxt.dropNow')}
										</AppButton>
									</CardActionBar>
								</AppListCard>
							{/if}
						{/each}
					</div>
				</AppControlPanel>
			{/if}
		</div>

		<AppDialog
			open={confirmOpen}
			title={confirmTitle}
			on:close={() => {
				if (confirmBusy) return;
				confirmOpen = false;
				confirmError = '';
				confirmKind = 'default';
			}}
		>
			<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">{confirmBody}</p>
			{#if confirmKind === 'jwxt-push'}
				<div class="mt-3 flex flex-col gap-2">
					<label class="flex flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
						<span class="text-[var(--app-color-fg-muted)]">{t('panels.jwxt.ttlLabel')}</span>
						<select
							class="w-full rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
							bind:value={pendingTtlMs}
							disabled={confirmBusy}
						>
							<option value={0}>{t('panels.jwxt.ttl0')}</option>
							<option value={120000}>{t('panels.jwxt.ttl120')}</option>
						</select>
					</label>
				</div>
			{/if}
			{#if confirmSections.length}
				<div class="mt-3 flex flex-col gap-3">
					{#each confirmSections as section (section.title)}
						<div class="flex flex-col gap-2">
							<p class="m-0 text-[var(--app-text-xs)] font-medium text-[var(--app-color-fg)]">{section.title}</p>
							{#if section.items.length}
								<ul class="m-0 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{#each section.items as item (item)}
										<li class="break-words [overflow-wrap:anywhere]">{item}</li>
									{/each}
								</ul>
							{:else}
								<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{t('panels.jwxt.confirm.pushDiffEmpty')}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			{#if confirmError}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{confirmError}</p>
			{/if}
			<div slot="actions" class="flex flex-wrap items-center justify-end gap-2">
				<AppButton variant="secondary" size="sm" on:click={() => (confirmOpen = false)} disabled={confirmBusy}>
					{t('panels.jwxt.confirm.cancel')}
				</AppButton>
				<AppButton variant={confirmVariant} size="sm" on:click={runConfirmedAction} loading={confirmBusy}>
					{confirmConfirmLabel}
				</AppButton>
			</div>
		</AppDialog>
	</ListSurface>
</DockPanelShell>
