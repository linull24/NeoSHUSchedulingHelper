<svelte:options runes={false} />

	<script lang="ts">
		import { onMount } from 'svelte';
		import { translator, type TranslateFn } from '$lib/i18n';
		import AsyncTaskProgress from '$lib/components/AsyncTaskProgress.svelte';
		import AppButton from '$lib/primitives/AppButton.svelte';
		import AppField from '$lib/primitives/AppField.svelte';
		import AppTextArea from '$lib/primitives/AppTextArea.svelte';
		import AppTextField from '$lib/primitives/AppTextField.svelte';
		import JwxtRoundSelector from '$lib/components/JwxtRoundSelector.svelte';
		import JwxtUserscriptActions from '$lib/components/JwxtUserscriptActions.svelte';
			import WizardDialog from './WizardDialog.svelte';
			import {
				localeSetting as localeSettingStore,
				setLocaleSetting,
				type LocaleSetting
			} from '$lib/stores/localePreference';
			import { refreshDetectedLocale } from '$lib/i18n/localeStore';
		import {
			selectionModeNeedsPrompt,
			selectionMode as selectionModeStore,
			homeCampus as homeCampusStore,
		setHomeCampus,
		setSelectionMode,
		type SelectionMode
	} from '$lib/stores/coursePreferences';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { setupWizardDone } from '$lib/stores/setupWizard';
	import { jwxtRememberedUserId } from '$lib/stores/jwxt';
	import { hasStoredJwxtCookieVault, loadJwxtCookieFromVault, saveJwxtCookieToVault } from '$lib/stores/jwxtCookieVault';
	import { getDatasetConfig } from '../../config/dataset';
	import { getUserscriptConfig } from '../../config/userscript';
	import { activateRoundSnapshot, fetchCloudRoundIndex, hasCloudSnapshot, hasRoundSnapshot } from '$lib/data/catalog/cloudSnapshot';
	import { datasetMeta } from '$lib/data/catalog/courseCatalog';
	import { resolveTermDisplayLabel } from '$lib/utils/termDisplay';
	import {
		jwxtGetRounds,
		jwxtGetStatus,
		jwxtImportCookie,
		jwxtLogin,
		jwxtSelectRound,
		type JwxtRoundInfo,
		type JwxtStatus
	} from '$lib/data/jwxt/jwxtApi';
	import { ensureTermStateLoaded } from '$lib/stores/termStateStore';
	import { jwxtCrawlState, startJwxtCrawl, stopJwxtCrawl } from '$lib/stores/jwxtCrawlTask';

	export let open = false;

	const datasetConfig = getDatasetConfig();
	const termId = datasetConfig.termId;
	const termLabel = resolveTermDisplayLabel({ termId, snapshotLabel: datasetMeta.semester });
	const userscriptConfig = getUserscriptConfig();

	let t: TranslateFn = (key) => key;
	$: t = $translator;

		type StepId = 'language' | 'userscript' | 'welcome' | 'selectionMode' | 'login' | 'cloud' | 'homeCampus';
		const stepOrder: StepId[] = ['language', 'userscript', 'welcome', 'selectionMode', 'login', 'cloud', 'homeCampus'];

		let step: StepId = 'language';
		let busy = false;
		let error = '';

		let localeChoice: LocaleSetting = 'auto';

		let selectionModeChoice: SelectionMode | null = null;
		let homeCampusChoice = '';

	let status: JwxtStatus | null = null;
	let statusMessage = '';
	let rounds: JwxtRoundInfo[] = [];
	let roundTermLabel = '';
	let selectedXkkzId = '';
	let roundBusy = false;
	let roundStatus = '';
	let roundCloudStatus = '';

	let userId = '';
	let password = '';

	let loginMethod: 'password' | 'cookie' = 'password';
	let cookieHeader = '';
	let vaultPassword = '';
	let vaultPasswordConfirm = '';
	let vaultUnlockPassword = '';
	let cookiePersist = true;
	let cookieHasVault = false;

		let cloudHasSnapshot = false;
		let cloudFetchStatus = '';
		let cloudStageText = '';
		let showCrawlProgress = false;

	let canGoNextStep = true;
	let nextEnabled = true;

	$: userId = $jwxtRememberedUserId;
		$: cookieHasVault = hasStoredJwxtCookieVault();
		$: cloudHasSnapshot = hasCloudSnapshot(termId);

		onMount(() => {
			localeChoice = ($localeSettingStore ?? 'auto') as LocaleSetting;
			selectionModeChoice = $selectionModeStore as SelectionMode | null;
			homeCampusChoice = ($homeCampusStore ?? '') as string;
			if (!homeCampusChoice.trim()) {
				homeCampusChoice = suggestDefaultCampus(filterOptions.campuses);
			}
		void ensureTermStateLoaded();
		void refreshStatus();
	});

	function suggestDefaultCampus(campuses: string[]): string {
		const list = campuses.map((c) => c.trim()).filter(Boolean);
		const BAOSHAN_MAIN = '\u5b9d\u5c71\u4e3b\u533a';
		const BAOSHAN = '\u5b9d\u5c71';
		const baoshanMain = list.find((c) => c.includes(BAOSHAN_MAIN));
		if (baoshanMain) return baoshanMain;
		const baoshanAny = list.find((c) => c.includes(BAOSHAN));
		return baoshanAny ?? list[0] ?? '';
	}

	async function refreshStatus() {
		try {
			const res = await jwxtGetStatus();
			if (!res.ok) {
				status = null;
				statusMessage = res.error;
				return;
			}
			status = res;
			statusMessage = '';
			if (res.supported && res.loggedIn) {
				void refreshRounds();
			}
		} catch (error_) {
			status = null;
			statusMessage = error_ instanceof Error ? error_.message : String(error_);
		}
	}

	function resetErrors() {
		error = '';
		cloudFetchStatus = '';
	}

	function formatCrawlStage(stage: string): string {
		return t(`common.crawlStages.${stage}`);
	}

	$: showCrawlProgress =
		$jwxtCrawlState.termId === termId &&
		($jwxtCrawlState.running || Boolean($jwxtCrawlState.progress?.total));
	$: cloudStageText = showCrawlProgress
		? $jwxtCrawlState.message || ($jwxtCrawlState.stage ? formatCrawlStage($jwxtCrawlState.stage) : '')
		: '';

	async function refreshRounds() {
		if (!status?.loggedIn) return;
		roundBusy = true;
		try {
			roundStatus = t('panels.jwxt.rounds.loading');
			roundCloudStatus = '';
			const res = await jwxtGetRounds();
			if (!res.ok) {
				rounds = [];
				roundTermLabel = '';
				selectedXkkzId = '';
				roundStatus = res.error;
				return;
			}
			rounds = res.rounds ?? [];
			const termParts = [res.term?.xkxnmc, res.term?.xkxqmc].filter(Boolean) as string[];
			roundTermLabel = termParts.join(' ') || '';
			const desired = (res.selectedXkkzId ?? res.activeXkkzId ?? '').trim();
			if (desired) selectedXkkzId = desired;
			else if (!selectedXkkzId && rounds.length) selectedXkkzId = rounds[0].xkkzId;
			roundStatus = '';
			void compareCloudRounds(res.rounds ?? []);
		} finally {
			roundBusy = false;
		}
	}

	async function compareCloudRounds(items: JwxtRoundInfo[]) {
		if (!items.length) return;
		roundCloudStatus = t('panels.jwxt.rounds.cloudCompareLoading');
		const cloud = await fetchCloudRoundIndex(termId);
		if (!cloud.ok) {
			roundCloudStatus = t('panels.jwxt.rounds.cloudCompareFailed', { error: cloud.error });
			return;
		}
		const cloudByLc = new Map(cloud.rounds.map((r) => [r.xklc, r]));
		const important = items.filter((r) => r.xklc === '1' || r.xklc === '2');
		const targets = important.length ? important : items.slice(0, 2);
		const missing: string[] = [];
		const mismatched: string[] = [];
		for (const r of targets) {
			if (!r.xklc) continue;
			const cloudRound = cloudByLc.get(r.xklc);
			if (!cloudRound) missing.push(r.xklc);
			else if (cloudRound.xkkzId && cloudRound.xkkzId !== r.xkkzId) mismatched.push(r.xklc);
		}
		if (!missing.length && !mismatched.length) {
			roundCloudStatus = t('panels.jwxt.rounds.cloudCompareOk');
			return;
		}
		roundCloudStatus = t('panels.jwxt.rounds.cloudCompareMismatch', {
			missing: missing.join(','),
			mismatched: mismatched.join(',')
		});
	}

	async function handleSelectRound(xkkzId: string) {
		if (!status?.loggedIn) return;
		const next = xkkzId.trim();
		if (!next || next === selectedXkkzId) return;
		selectedXkkzId = next;
		roundBusy = true;
		try {
			roundStatus = '';
			const res = await jwxtSelectRound({ xkkzId: next });
			if (!res.ok) {
				roundStatus = res.error;
				return;
			}
			selectedXkkzId = res.selectedXkkzId || next;
			if (hasRoundSnapshot(termId, selectedXkkzId)) {
				const activated = activateRoundSnapshot(termId, selectedXkkzId);
				if (activated.ok) cloudFetchStatus = t('setupWizard.cloud.status.roundSnapshotActivated');
			}
		} finally {
			roundBusy = false;
		}
	}

		$: progressCurrent = Math.max(1, stepOrder.indexOf(step) + 1);
		const progressTotal = stepOrder.length;
		const lastStep = stepOrder[stepOrder.length - 1] ?? 'homeCampus';
		$: isLastStep = step === lastStep;

		$: canGoNextStep =
			step === 'language'
				? Boolean(localeChoice)
				: step === 'selectionMode'
					? Boolean(selectionModeChoice)
					: step === 'homeCampus'
						? filterOptions.campuses.length
							? Boolean(homeCampusChoice.trim())
							: true
						: true;

		$: nextEnabled = isLastStep ? canGoNextStep && !$selectionModeNeedsPrompt : canGoNextStep;

		function next() {
			resetErrors();
			if (!canGoNextStep) return;
			if (step === 'language') setLocaleSetting(localeChoice);
			if (step === 'selectionMode' && selectionModeChoice) setSelectionMode(selectionModeChoice);
			if (step === 'homeCampus') setHomeCampus(homeCampusChoice);
			const idx = stepOrder.indexOf(step);
			step = stepOrder[Math.min(stepOrder.length - 1, idx + 1)] ?? step;
		}

		function back() {
			resetErrors();
			const idx = stepOrder.indexOf(step);
			step = stepOrder[Math.max(0, idx - 1)] ?? step;
		}

	function close() {
		if ($selectionModeNeedsPrompt) {
			setSelectionMode(selectionModeChoice ?? 'allowOverflowMode');
		}
		open = false;
		setupWizardDone.set(true);
	}

	async function doLoginWithPassword() {
		resetErrors();
		busy = true;
		try {
			if (!userId.trim() || !password) {
				error = t('setupWizard.login.errors.missingCredentials');
				return;
			}
			const res = await jwxtLogin({ userId: userId.trim(), password });
			if (!res.ok) {
				error = res.error;
				return;
			}
			await refreshStatus();
			if (!status?.loggedIn) {
				error = t('setupWizard.login.errors.loginFailed');
				return;
			}
			password = '';
			statusMessage = t('setupWizard.login.status.loggedIn');
		} finally {
			busy = false;
		}
	}

	async function doImportCookie() {
		resetErrors();
		busy = true;
		try {
			if (!cookieHeader.trim()) {
				error = t('setupWizard.login.errors.missingCookie');
				return;
			}
			if (cookiePersist) {
				if (!vaultPassword || vaultPassword.length < 6) {
					error = t('setupWizard.login.errors.vaultPasswordTooShort');
					return;
				}
				if (vaultPassword !== vaultPasswordConfirm) {
					error = t('setupWizard.login.errors.vaultPasswordMismatch');
					return;
				}
			}
			const res = await jwxtImportCookie({
				userId: userId.trim() ? userId.trim() : undefined,
				cookie: cookieHeader.trim()
			});
			if (!res.ok) {
				error = res.error;
				return;
			}
			if (!res.loggedIn) {
				error = t('setupWizard.login.errors.loginFailed');
				return;
			}
			if (cookiePersist) {
				try {
					await saveJwxtCookieToVault(cookieHeader.trim(), vaultPassword);
				} catch (saveError) {
					error = saveError instanceof Error ? saveError.message : String(saveError);
					return;
				}
			}
			cookieHeader = '';
			vaultPassword = '';
			vaultPasswordConfirm = '';
			await refreshStatus();
			statusMessage = t('setupWizard.login.status.loggedIn');
		} catch (error_) {
			error = error_ instanceof Error ? error_.message : String(error_);
		} finally {
			busy = false;
		}
	}

	async function unlockVaultAndImport() {
		resetErrors();
		busy = true;
		try {
			if (!vaultUnlockPassword) {
				error = t('setupWizard.login.errors.missingVaultPassword');
				return;
			}
			const cookie = await loadJwxtCookieFromVault(vaultUnlockPassword);
			const res = await jwxtImportCookie({
				userId: userId.trim() ? userId.trim() : undefined,
				cookie
			});
			if (!res.ok) {
				error = res.error;
				return;
			}
			if (!res.loggedIn) {
				error = t('setupWizard.login.errors.loginFailed');
				return;
			}
			vaultUnlockPassword = '';
			await refreshStatus();
			statusMessage = t('setupWizard.login.status.loggedIn');
		} catch (error_) {
			error = error_ instanceof Error ? error_.message : String(error_);
		} finally {
			busy = false;
		}
	}

		async function fetchCloudTermSnapshot() {
			resetErrors();
			try {
				const res = await startJwxtCrawl(termId);
				if (!res.ok) {
					if (res.error === 'CANCELED') {
						cloudFetchStatus = t('setupWizard.cloud.status.canceled');
						return;
					}
					cloudFetchStatus = `${t('setupWizard.cloud.status.failed')}: ${res.error}`;
					return;
				}
				cloudFetchStatus = t('setupWizard.cloud.status.ok');
			} catch (error_) {
				cloudFetchStatus = `${t('setupWizard.cloud.status.failed')}: ${
					error_ instanceof Error ? error_.message : String(error_)
				}`;
			}
		}

		async function stopCloudFetch() {
			resetErrors();
			const res = await stopJwxtCrawl();
			if (!res.ok) cloudFetchStatus = `${t('setupWizard.cloud.status.failed')}: ${res.error}`;
			else cloudFetchStatus = t('setupWizard.cloud.status.canceled');
		}

	function finish() {
		resetErrors();
		if (!canGoNextStep) return;
		if (step === 'homeCampus' && filterOptions.campuses.length && homeCampusChoice.trim()) {
			setHomeCampus(homeCampusChoice);
		}
		setupWizardDone.set(true);
		close();
	}
	</script>

	<WizardDialog
		{open}
		title={t('setupWizard.title')}
		progressText={t('setupWizard.progress', { current: progressCurrent, total: progressTotal })}
		metaText={t('setupWizard.termLabel', { term: termLabel })}
		busy={busy}
		error={error || null}
		closeEnabled={true}
		backEnabled={step !== 'language'}
		nextEnabled={nextEnabled}
		backLabel={step !== 'language' ? t('setupWizard.actions.back') : ''}
		nextLabel={isLastStep ? t('setupWizard.actions.finish') : t('setupWizard.actions.next')}
		closeLabel={t('setupWizard.actions.close')}
			class="w-[min(720px,92vw)]"
			on:back={back}
			on:next={isLastStep ? finish : next}
			on:close={close}
		>
			{#if step === 'language'}
				<div class="flex flex-col gap-2">
					<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.language.body')}</p>
					<div class="flex flex-wrap items-center gap-2">
						<AppButton
							variant={localeChoice === 'auto' ? 'primary' : 'secondary'}
							size="sm"
							on:click={() => {
								localeChoice = 'auto';
								refreshDetectedLocale();
								setLocaleSetting('auto');
								step = 'userscript';
							}}
						>
							{t('setupWizard.language.options.auto')}
						</AppButton>
						<AppButton
							variant={localeChoice === 'zh-CN' ? 'primary' : 'secondary'}
							size="sm"
							on:click={() => {
								localeChoice = 'zh-CN';
								setLocaleSetting('zh-CN');
								step = 'userscript';
							}}
						>
							{t('setupWizard.language.options.zh')}
						</AppButton>
						<AppButton
							variant={localeChoice === 'en-US' ? 'primary' : 'secondary'}
							size="sm"
							on:click={() => {
								localeChoice = 'en-US';
								setLocaleSetting('en-US');
								step = 'userscript';
							}}
						>
							{t('setupWizard.language.options.en')}
						</AppButton>
					</div>
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.language.hint')}</p>
				</div>
			{:else if step === 'userscript'}
				<div class="flex flex-col gap-3">
					<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.userscript.body')}</p>
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.userscript.hint')}</p>
					<JwxtUserscriptActions
						config={userscriptConfig}
						size="sm"
						installLabel={t('panels.jwxt.helpUserscript')}
						helpLabel={t('panels.jwxt.helpLink')}
					/>
				</div>
			{:else if step === 'welcome'}
				<div class="flex flex-col gap-2">
					<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.welcome.body')}</p>
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('setupWizard.welcome.hint')}</p>
				</div>
			{:else if step === 'selectionMode'}
				<div class="flex flex-col gap-2">
					<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.selectionMode.body')}</p>
					<div class="flex flex-wrap items-center gap-2">
						<AppButton
							variant={selectionModeChoice === 'allowOverflowMode' ? 'primary' : 'secondary'}
							size="sm"
							on:click={() => (selectionModeChoice = 'allowOverflowMode')}
						>
							{t('setupWizard.selectionMode.allowOverflow')}
						</AppButton>
						<AppButton
							variant={selectionModeChoice === 'overflowSpeedRaceMode' ? 'primary' : 'secondary'}
							size="sm"
							on:click={() => (selectionModeChoice = 'overflowSpeedRaceMode')}
						>
							{t('setupWizard.selectionMode.speedRace')}
						</AppButton>
					</div>
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.selectionMode.hint')}</p>
				</div>
			{:else if step === 'login'}
				<div class="flex flex-col gap-3">
					<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.login.body')}</p>
					{#if status?.loggedIn}
					<div class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3 text-[var(--app-text-sm)]">
						<div class="font-medium">{t('setupWizard.login.status.loggedIn')}</div>
					</div>
				{:else}
					<div class="flex flex-wrap items-center gap-2">
						<AppButton variant={loginMethod === 'password' ? 'primary' : 'secondary'} size="sm" on:click={() => (loginMethod = 'password')}>
							{t('setupWizard.login.methods.password')}
						</AppButton>
						<AppButton variant={loginMethod === 'cookie' ? 'primary' : 'secondary'} size="sm" on:click={() => (loginMethod = 'cookie')}>
							{t('setupWizard.login.methods.cookie')}
						</AppButton>
					</div>

						{#if loginMethod === 'password'}
							<div class="flex flex-col gap-2">
								<AppField label={t('setupWizard.login.userId')}>
									<AppTextField bind:value={userId} />
								</AppField>
								<AppField label={t('setupWizard.login.password')}>
									<AppTextField type="password" bind:value={password} />
								</AppField>
								<div class="flex flex-wrap gap-2">
									<AppButton variant="primary" size="sm" disabled={busy} on:click={doLoginWithPassword}>
										{t('setupWizard.login.actions.login')}
									</AppButton>
								<AppButton variant="secondary" size="sm" disabled={busy} on:click={refreshStatus}>
									{t('setupWizard.login.actions.check')}
								</AppButton>
							</div>
						</div>
					{:else}
							<div class="flex flex-col gap-2">
								<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-warning)]">{t('setupWizard.login.cookieWarning')}</p>
								<AppField label={t('setupWizard.login.cookieHeader')}>
									<AppTextArea rows={3} bind:value={cookieHeader} />
								</AppField>
								<label class="flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									<input type="checkbox" bind:checked={cookiePersist} />
									<span>{t('setupWizard.login.persistCookie')}</span>
								</label>
								{#if cookiePersist}
									<div class="grid gap-2 sm:grid-cols-2">
										<AppField label={t('setupWizard.login.vaultPassword')}>
											<AppTextField type="password" bind:value={vaultPassword} />
										</AppField>
										<AppField label={t('setupWizard.login.vaultPasswordConfirm')}>
											<AppTextField type="password" bind:value={vaultPasswordConfirm} />
										</AppField>
									</div>
								{/if}
							<div class="flex flex-wrap gap-2">
								<AppButton variant="primary" size="sm" disabled={busy} on:click={doImportCookie}>
									{t('setupWizard.login.actions.importCookie')}
								</AppButton>
							</div>

								{#if cookieHasVault}
									<div class="flex flex-col gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
										<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.login.unlockHint')}</div>
										<div class="flex flex-wrap items-end gap-2">
											<div class="min-w-[220px] flex-1">
												<AppField label={t('setupWizard.login.vaultPassword')}>
													<AppTextField type="password" bind:value={vaultUnlockPassword} />
												</AppField>
											</div>
											<AppButton variant="secondary" size="sm" disabled={busy} on:click={unlockVaultAndImport}>
												{t('setupWizard.login.actions.unlockAndImport')}
											</AppButton>
										</div>
									</div>
								{/if}
						</div>
					{/if}
				{/if}

				{#if statusMessage}
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{statusMessage}</p>
				{/if}
			</div>
		{:else if step === 'cloud'}
			<div class="flex flex-col gap-2">
				<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.cloud.body')}</p>
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.cloud.hint')}</p>
				{#if status?.loggedIn}
					<JwxtRoundSelector
						roundTermLabel={roundTermLabel}
						rounds={rounds}
						selectedXkkzId={selectedXkkzId}
						busy={roundBusy}
						statusText={roundStatus || roundCloudStatus}
						refreshDisabled={$jwxtCrawlState.running}
						on:refresh={refreshRounds}
						on:select={(event) => handleSelectRound(event.detail.xkkzId)}
					/>
				{/if}
				<div class="flex flex-wrap gap-2">
					<AppButton variant="primary" size="sm" disabled={busy || $jwxtCrawlState.running} on:click={fetchCloudTermSnapshot}>
						{t('setupWizard.cloud.actions.fetch')}
					</AppButton>
					{#if $jwxtCrawlState.running}
						<AppButton variant="secondary" size="sm" disabled={busy} on:click={stopCloudFetch}>
							{t('setupWizard.cloud.actions.stop')}
						</AppButton>
					{/if}
					{#if cloudHasSnapshot}
						<span class="self-center text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('setupWizard.cloud.status.cached')}
						</span>
					{/if}
				</div>
				<AsyncTaskProgress
					visible={showCrawlProgress}
					statusText={cloudStageText}
					progress={$jwxtCrawlState.progress}
					progressText={
						$jwxtCrawlState.progress?.total
							? t('setupWizard.cloud.status.progress', {
									done: $jwxtCrawlState.progress.done,
									total: $jwxtCrawlState.progress.total
								})
							: ''
					}
				/>
				{#if cloudFetchStatus}
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{cloudFetchStatus}</p>
				{/if}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.cloud.reloadHint')}</p>
			</div>
		{:else if step === 'homeCampus'}
			<div class="flex flex-col gap-2">
				<p class="m-0 text-[var(--app-text-sm)]">{t('setupWizard.homeCampus.body')}</p>
				{#if filterOptions.campuses.length === 0}
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('setupWizard.homeCampus.noOptions')}</p>
				{:else}
					<AppField label={t('setupWizard.homeCampus.label')} description={t('setupWizard.homeCampus.hint')}>
						<select class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2" bind:value={homeCampusChoice}>
							{#each filterOptions.campuses as campus (campus)}
								<option value={campus}>{campus}</option>
							{/each}
						</select>
					</AppField>
				{/if}
			</div>
		{/if}
	</WizardDialog>
