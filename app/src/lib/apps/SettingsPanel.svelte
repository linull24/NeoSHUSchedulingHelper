<svelte:options runes={false} />

<script lang="ts">
	import {
		selectedTheme,
		availableThemes,
		collapseCoursesByName,
		handleThemeChange,
		toggleCollapseSetting,
		crossCampusAllowed,
		selectionMode,
		toggleCrossCampus,
		setSelectionModeSetting,
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
	import { locale, type LocaleId } from '$lib/stores/localePreference';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';

	let t = (key: string) => key;
	$: t = $translator;
	$: currentLocale = $locale;

	function handleLocaleChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value as LocaleId;
		locale.set(next);
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('settings.title')}
		subtitle={t('settings.subtitle')}
		density="comfortable"
		enableStickyToggle={true}
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
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2"
							bind:value={$selectedTheme}
							on:change={handleThemeChange}
						>
							{#each availableThemes as theme (theme.id)}
								<option value={theme.id}>{theme.label}</option>
							{/each}
						</select>
					</AppField>
					<AppField
						label={t('settings.languageLabel')}
						description={t('settings.languageDesc')}
						class="flex-1 min-w-[min(260px,100%)]"
					>
						<select
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2"
							value={currentLocale}
							on:change={handleLocaleChange}
						>
							<option value="zh-CN">{t('settings.languageOptions.zh')}</option>
							<option value="en-US">{t('settings.languageOptions.en')}</option>
						</select>
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

				<AppField label={t('settings.crossCampusLabel')} description={t('settings.crossCampusDesc')}>
					<AppButton
						variant={$crossCampusAllowed ? 'primary' : 'secondary'}
						size="sm"
						on:click={toggleCrossCampus}
					>
						{$crossCampusAllowed ? t('settings.crossCampusOn') : t('settings.crossCampusOff')}
					</AppButton>
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
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2"
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
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2"
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
		</div>
	</ListSurface>
</DockPanelShell>
