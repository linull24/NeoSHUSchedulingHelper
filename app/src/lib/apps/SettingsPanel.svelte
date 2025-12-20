<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		metaConfig,
		selectedTheme,
		availableThemes,
		materialSeedColor,
		fluentAccentColor,
		collapseCoursesByName,
		minAcceptableBatchLabel,
		handleThemeChange,
		handleMaterialSeedColorChange,
		setMaterialSeedColorValue,
		handleFluentAccentColorChange,
		setFluentAccentColorValue,
		toggleCollapseSetting,
		hideFilterStatusControl,
		toggleHideFilterStatusControl,
		crossCampusAllowed,
		homeCampus,
		selectionMode,
		toggleCrossCampus,
		setHomeCampusSetting,
		setSelectionModeSetting,
		setMinAcceptableBatchSetting,
		paginationMode,
		pageSize,
		pageNeighbors,
		showWeekends,
		setPaginationMode,
		setPageSize,
		setPageNeighbors,
		toggleWeekends
	} from './SettingsPanel.state';
	import { translator } from '$lib/i18n';
	import { localeSetting } from '$lib/stores/localePreference';
	import { termState, dispatchTermAction } from '$lib/stores/termStateStore';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { getFilterOptionsForScope } from '$lib/stores/courseFilters';
	import { ensureServiceWorkerRegistered, type ServiceWorkerStatus } from '$lib/pwa/serviceWorker';
	import { ENROLLMENT_BATCH_ORDER } from '../../../shared/jwxtCrawler/batchPolicy';

	let t = (key: string) => key;
	$: t = $translator;
	const filterOptions = getFilterOptionsForScope('all');
	$: currentLocale = $localeSetting;
	$: isMaterialTheme = $selectedTheme === 'material';
	$: isFluentTheme = $selectedTheme === 'fluent';
	$: materialPresets = ['#3556c4', '#0061a4', '#6750a4', '#0f766e', '#b91c1c', '#f59e0b', '#111827'];
	$: fluentPresets = ['#0078d4', '#0f6cbd', '#107c10', '#c50f1f', '#8e562e', '#5c2d91', '#111827'];

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	};

	let pwaInstalled = false;
	let pwaInstallable = false;
	let pwaInstallPrompt: BeforeInstallPromptEvent | null = null;
	let pwaInstallStatus: 'idle' | 'prompted' | 'accepted' | 'dismissed' | 'error' = 'idle';

	let swStatus: ServiceWorkerStatus = { supported: false, registered: false, controlled: false };

	function openExternalLink(href: string) {
		if (!browser) return;
		window.open(href, '_blank', 'noopener,noreferrer');
	}

	function handleLocaleChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value;
		localeSetting.set(next as any);
	}

	function computeStandalone(): boolean {
		if (!browser) return false;
		const legacyStandalone = (navigator as any).standalone === true;
		const mediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
		return legacyStandalone || mediaStandalone;
	}

	async function handlePwaInstall() {
		if (!pwaInstallPrompt) return;
		pwaInstallStatus = 'prompted';
		try {
			await pwaInstallPrompt.prompt();
			const choice = await pwaInstallPrompt.userChoice;
			pwaInstallStatus = choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
			pwaInstallPrompt = null;
			pwaInstallable = false;
			pwaInstalled = computeStandalone();
		} catch {
			pwaInstallStatus = 'error';
		}
	}

	onMount(() => {
		if (!browser) return;

		const updateStandalone = () => {
			pwaInstalled = computeStandalone();
		};

		const standaloneMedia = window.matchMedia?.('(display-mode: standalone)') ?? null;
		standaloneMedia?.addEventListener?.('change', updateStandalone);

		const onBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			pwaInstallPrompt = event as BeforeInstallPromptEvent;
			pwaInstallable = true;
		};

		const onAppInstalled = () => {
			pwaInstallStatus = 'accepted';
			pwaInstallPrompt = null;
			pwaInstallable = false;
			updateStandalone();
		};

		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
		window.addEventListener('appinstalled', onAppInstalled);
		updateStandalone();
		void ensureServiceWorkerRegistered().then((result) => {
			swStatus = result;
		});

		return () => {
			standaloneMedia?.removeEventListener?.('change', updateStandalone);
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
			window.removeEventListener('appinstalled', onAppInstalled);
		};
	});
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('settings.title')}
		subtitle={t('settings.subtitle')}
		density="comfortable"
	>
		<div class="flex flex-wrap items-start gap-5">
			<AppControlPanel
				title={t('settings.displaySection')}
				density="comfortable"
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<AppControlRow>
					<AppField label={t('settings.theme')} class="flex-1 min-w-[min(260px,100%)]">
							<select
								class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
								bind:value={$selectedTheme}
								on:change={handleThemeChange}
							>
							{#each availableThemes as theme (theme.id)}
								<option value={theme.id}>{theme.label}</option>
							{/each}
						</select>
					</AppField>

					{#if isMaterialTheme}
						{@const presets = materialPresets}
						<AppField
							label={t('settings.themeColorLabel')}
							description={t('settings.themeColorDesc')}
							class="flex-1 min-w-[min(260px,100%)]"
						>
							<div class="flex items-center gap-3">
								<input
									class="h-10 w-12 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-transparent p-1"
									type="color"
									value={$materialSeedColor}
									on:input={handleMaterialSeedColorChange}
								/>
								<input
									class="flex-1 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2 font-mono"
									type="text"
									value={$materialSeedColor}
									on:change={handleMaterialSeedColorChange}
									autocomplete="off"
									spellcheck={false}
								/>
							</div>

							<div class="mt-3 flex flex-wrap items-center gap-2">
								{#each presets as hex (hex)}
										<button
											type="button"
											class={`theme-swatch h-7 w-7 rounded-[var(--app-radius-md)] border ${
												hex === $materialSeedColor
													? 'border-[color:var(--app-color-primary)] [box-shadow:0_0_0_2px_var(--app-color-focus-ring)]'
													: 'border-[color:var(--app-color-control-border)]'
											}`}
											style={`background:${hex};`}
											aria-label={hex}
											on:click={() => setMaterialSeedColorValue(hex)}
										></button>
								{/each}
							</div>

							<div class="mt-3 flex flex-wrap items-center gap-2">
									<div
										class="h-8 min-w-[72px] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] px-2 flex items-center justify-center text-[var(--app-text-xs)]"
										style="background: rgb(var(--mdui-color-primary, 53, 86, 196)); color: rgb(var(--mdui-color-on-primary, 255, 255, 255));"
									>
										primary
									</div>
									<div
										class="h-8 min-w-[72px] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] px-2 flex items-center justify-center text-[var(--app-text-xs)]"
										style="background: rgb(var(--mdui-color-secondary, 92, 93, 114)); color: rgb(var(--mdui-color-on-secondary, 255, 255, 255));"
									>
										secondary
									</div>
									<div
										class="h-8 min-w-[72px] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] px-2 flex items-center justify-center text-[var(--app-text-xs)]"
										style="background: rgb(var(--mdui-color-tertiary, 122, 84, 137)); color: rgb(var(--mdui-color-on-tertiary, 255, 255, 255));"
									>
										tertiary
									</div>
									<div
										class="h-8 min-w-[72px] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] px-2 flex items-center justify-center text-[var(--app-text-xs)]"
										style="background: rgb(var(--mdui-color-error, 186, 26, 26)); color: rgb(var(--mdui-color-on-error, 255, 255, 255));"
									>
										error
									</div>
							</div>
						</AppField>
					{/if}

					{#if isFluentTheme}
						{@const presets = fluentPresets}
						<AppField
							label={t('settings.fluentAccentColorLabel')}
							description={t('settings.fluentAccentColorDesc')}
							class="flex-1 min-w-[min(260px,100%)]"
						>
							<div class="flex items-center gap-3">
								<input
									class="h-10 w-12 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-transparent p-1"
									type="color"
									value={$fluentAccentColor}
									on:input={handleFluentAccentColorChange}
								/>
								<input
									class="flex-1 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2 font-mono"
									type="text"
									value={$fluentAccentColor}
									on:change={handleFluentAccentColorChange}
									autocomplete="off"
									spellcheck={false}
								/>
							</div>

							<div class="mt-3 flex flex-wrap items-center gap-2">
								{#each presets as hex (hex)}
										<button
											type="button"
											class={`theme-swatch h-7 w-7 rounded-[var(--app-radius-md)] border ${
												hex === $fluentAccentColor
													? 'border-[color:var(--app-color-primary)] [box-shadow:0_0_0_2px_var(--app-color-focus-ring)]'
													: 'border-[color:var(--app-color-control-border)]'
											}`}
											style={`background:${hex};`}
											aria-label={hex}
											on:click={() => setFluentAccentColorValue(hex)}
										></button>
								{/each}
							</div>
						</AppField>
					{/if}

					<AppField
						label={t('settings.languageLabel')}
						description={t('settings.languageDesc')}
						class="flex-1 min-w-[min(260px,100%)]"
					>
							<select
								class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
								value={currentLocale}
								on:change={handleLocaleChange}
							>
							<option value="auto">{t('settings.languageOptions.auto')}</option>
							<option value="zh-CN">{t('settings.languageOptions.zh')}</option>
							<option value="en-US">{t('settings.languageOptions.en')}</option>
						</select>
					</AppField>
				</AppControlRow>
			</AppControlPanel>

			<AppControlPanel
				title={t('settings.filtersSection')}
				density="comfortable"
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<AppControlRow>
					<AppField
						label={t('settings.minAcceptableBatchLabel')}
						description={t('settings.minAcceptableBatchHint')}
						class="flex-1 min-w-[min(320px,100%)]"
					>
						<select
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
							value={$minAcceptableBatchLabel ?? ''}
							on:change={(event) => setMinAcceptableBatchSetting((event.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">{t('settings.minAcceptableBatchOff')}</option>
							{#each ENROLLMENT_BATCH_ORDER as label (label)}
								<option value={label}>{label}</option>
							{/each}
						</select>
					</AppField>
				</AppControlRow>
				<AppControlRow>
					<AppField label={t('settings.userscriptSnapshotConcurrencyLabel')} description={t('settings.userscriptSnapshotConcurrencyHint')} class="flex-1 min-w-[min(320px,100%)]">
						<input
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2 font-mono"
							type="number"
							min="1"
							max="48"
							step="1"
							value={$termState?.settings.jwxt.snapshotConcurrency ?? 32}
							on:change={(e) => {
								const n = Number.parseInt((e.currentTarget as HTMLInputElement).value || '0', 10);
								void dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { jwxt: { ...($termState?.settings.jwxt ?? {}), snapshotConcurrency: n } } as any });
							}}
						/>
					</AppField>
					<AppField label={t('settings.userscriptRoundsConcurrencyLabel')} description={t('settings.userscriptRoundsConcurrencyHint')} class="flex-1 min-w-[min(320px,100%)]">
						<input
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2 font-mono"
							type="number"
							min="1"
							max="24"
							step="1"
							value={$termState?.settings.jwxt.roundsConcurrency ?? 12}
							on:change={(e) => {
								const n = Number.parseInt((e.currentTarget as HTMLInputElement).value || '0', 10);
								void dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { jwxt: { ...($termState?.settings.jwxt ?? {}), roundsConcurrency: n } } as any });
							}}
						/>
					</AppField>
				</AppControlRow>
			</AppControlPanel>

			<AppControlPanel
				title={t('settings.behaviorSection')}
				density="comfortable"
				class="flex-[1_1_620px] min-w-[min(360px,100%)] max-w-[980px]"
			>
				<AppField label={t('settings.collapseLabel')} description={t('settings.collapseDesc')}>
					<AppButton
						variant={$collapseCoursesByName ? 'primary' : 'secondary'}
						size="sm"
						on:click={toggleCollapseSetting}
					>
						{$collapseCoursesByName ? t('settings.collapseOn') : t('settings.collapseOff')}
					</AppButton>
				</AppField>

				<AppField
					label={t('settings.hideFilterStatusLabel')}
					description={t('settings.hideFilterStatusDesc')}
				>
					<AppButton
						variant={$hideFilterStatusControl ? 'primary' : 'secondary'}
						size="sm"
						on:click={toggleHideFilterStatusControl}
					>
						{$hideFilterStatusControl ? t('settings.hideFilterStatusOn') : t('settings.hideFilterStatusOff')}
					</AppButton>
				</AppField>

				<AppField label={t('settings.crossCampusLabel')} description={t('settings.crossCampusDesc')}>
					<AppButton
						variant={$crossCampusAllowed ? 'primary' : 'secondary'}
						size="sm"
						on:click={toggleCrossCampus}
					>
						{$crossCampusAllowed ? t('settings.crossCampusOn') : t('settings.crossCampusOff')}
					</AppButton>
				</AppField>

				<AppField label={t('settings.homeCampusLabel')} description={t('settings.homeCampusDesc')}>
					<select
						class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
						value={$homeCampus}
						on:change={(e) => setHomeCampusSetting((e.currentTarget as HTMLSelectElement).value)}
					>
						{#each filterOptions.campuses as campus (campus)}
							<option value={campus}>{campus}</option>
						{/each}
					</select>
				</AppField>

				<AppControlRow>
					<AppField
						label={t('settings.modeLabel')}
						description={t('settings.modeDesc')}
						class="flex-[2_1_360px] min-w-[min(320px,100%)]"
					>
						<div class="flex flex-wrap gap-2">
							<AppButton
								variant={$selectionMode === 'allowOverflowMode' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => setSelectionModeSetting('allowOverflowMode')}
							>
								{t('settings.allowOverflowMode')}
							</AppButton>
							<AppButton
								variant={$selectionMode === 'overflowSpeedRaceMode' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => setSelectionModeSetting('overflowSpeedRaceMode')}
							>
								{t('settings.overflowSpeedRaceMode')}
							</AppButton>
						</div>
					</AppField>

					<AppField
						label={t('settings.paginationLabel')}
						description={t('settings.paginationDesc')}
						class="flex-[1_1_320px] min-w-[min(280px,100%)]"
					>
						<div class="flex flex-wrap gap-2">
							<AppButton
								variant={$paginationMode === 'paged' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => setPaginationMode('paged')}
							>
								{t('settings.paged')}
							</AppButton>
							<AppButton
								variant={$paginationMode === 'continuous' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => setPaginationMode('continuous')}
							>
								{t('settings.continuous')}
							</AppButton>
						</div>
					</AppField>
				</AppControlRow>

				<AppControlRow>
					<AppField label={t('settings.pageSize')} class="flex-1 min-w-[min(200px,100%)]">
							<input
								class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
								type="number"
								min="1"
								value={$pageSize}
								on:change={(e) => setPageSize(Number((e.currentTarget as HTMLInputElement).value))}
						/>
					</AppField>
					<AppField
						label={t('settings.pageNeighbors')}
						class="flex-1 min-w-[min(200px,100%)]"
					>
							<input
								class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-control-border)] bg-[var(--app-color-bg)] px-3 py-2"
								type="number"
								min="1"
								value={$pageNeighbors}
								on:change={(e) => setPageNeighbors(Number((e.currentTarget as HTMLInputElement).value))}
							/>
					</AppField>
				</AppControlRow>

				<AppField label={t('settings.weekendLabel')} description={t('settings.weekendDesc')}>
					<AppButton
						variant={$showWeekends ? 'primary' : 'secondary'}
						size="sm"
						on:click={toggleWeekends}
					>
						{$showWeekends ? t('settings.weekendOn') : t('settings.weekendOff')}
					</AppButton>
				</AppField>
			</AppControlPanel>

			<AppControlPanel
				title={t('settings.pwaSection')}
				density="comfortable"
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<AppField
					label={t('settings.pwaInstallStateLabel')}
					description={t('settings.pwaInstallStateDesc')}
				>
					<div class="flex flex-col gap-1">
						<div class="text-[var(--app-text-sm)] font-medium">
							{pwaInstalled ? t('settings.pwaInstalledYes') : t('settings.pwaInstalledNo')}
						</div>
						<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('settings.pwaInstallHint')}
						</div>
					</div>
				</AppField>

				<AppField
					label={t('settings.pwaOfflineStateLabel')}
					description={t('settings.pwaOfflineStateDesc')}
				>
					<div class="flex flex-col gap-1">
						<div class="text-[var(--app-text-sm)] font-medium">
							{#if !swStatus.supported}
								{t('settings.pwaSwUnsupported')}
							{:else if swStatus.disabledInDev}
								{t('settings.pwaSwDevDisabled')}
							{:else if swStatus.registered}
								{swStatus.controlled ? t('settings.pwaSwControlled') : t('settings.pwaSwRegistered')}
							{:else}
								{t('settings.pwaSwNotRegistered')}
							{/if}
						</div>
						{#if swStatus.error}
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{swStatus.error}</div>
						{/if}
					</div>
				</AppField>

				<AppField label={t('settings.pwaInstallActionLabel')} description={t('settings.pwaInstallActionDesc')}>
					<div class="flex flex-wrap items-center gap-2">
						<AppButton
							variant={pwaInstallable ? 'primary' : 'secondary'}
							size="sm"
							disabled={!pwaInstallable}
							on:click={handlePwaInstall}
						>
							{t('settings.pwaInstallButton')}
						</AppButton>
						{#if pwaInstallStatus === 'dismissed'}
							<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{t('settings.pwaInstallDismissed')}
							</span>
						{:else if pwaInstallStatus === 'error'}
							<span class="text-[var(--app-text-xs)] text-[var(--app-color-danger)]">
								{t('settings.pwaInstallFailed')}
							</span>
						{/if}
					</div>
				</AppField>
			</AppControlPanel>

			<AppControlPanel
				title={t('settings.aboutSection')}
				density="comfortable"
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<div class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t(metaConfig.about.descriptionKey)}
				</div>

				<AppField label={t('settings.aboutProductLabel')} description={t('settings.aboutProductDesc')}>
					<div class="about-product">
						<div class="about-logo">
							<img
								class="about-logo-img"
								src={metaConfig.branding.iconSrc}
								alt={t(metaConfig.branding.iconAltKey)}
							/>
						</div>
						<div class="min-w-[min(240px,100%)] flex-1 flex flex-col gap-2">
							<div class="text-[var(--app-text-md)] font-semibold">{t(metaConfig.productNameKey)}</div>
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{t(metaConfig.productBylineKey)}
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<AppButton
									variant="secondary"
									size="sm"
									on:click={() => openExternalLink(metaConfig.homepage)}
								>
									{t('settings.aboutOpenHomepage')}
								</AppButton>
							</div>
						</div>
					</div>
				</AppField>

				{#each metaConfig.about.groups as group (group.id)}
					<AppField label={t(group.titleKey)}>
						<div class="flex flex-wrap items-center gap-2">
							{#each group.links as link (link.id)}
								<AppButton variant="secondary" size="sm" on:click={() => openExternalLink(link.href)}>
									{t(link.labelKey)}
								</AppButton>
							{/each}
						</div>
					</AppField>
				{/each}
			</AppControlPanel>
		</div>
	</ListSurface>
	</DockPanelShell>

<style>
	.theme-swatch {
		transition: transform var(--app-transition-fast);
	}

	.theme-swatch:hover {
		transform: scale(var(--app-interaction-scale-hover));
	}

	.theme-swatch:active {
		transform: scale(var(--app-interaction-scale-active));
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-swatch {
			transition: none;
		}

		.theme-swatch:hover,
		.theme-swatch:active {
			transform: none;
		}
	}

	.about-product {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--app-space-3);
	}

	.about-logo {
		--about-logo-size: clamp(48px, 9vw, 72px);
		width: var(--about-logo-size);
		height: var(--about-logo-size);
		flex: 0 0 auto;
		border-radius: var(--app-radius-lg);
		border: 1px solid var(--app-color-control-border);
		background: var(--app-color-bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.about-logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: var(--app-space-2);
	}
</style>
