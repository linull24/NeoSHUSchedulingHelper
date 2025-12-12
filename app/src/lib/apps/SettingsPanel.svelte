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
	import '$lib/styles/panels/settings-panel.scss';

	let t = (key: string) => key;
	$: t = $translator;
	$: currentLocale = $locale;

	function handleLocaleChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value as LocaleId;
		locale.set(next);
	}
</script>

<DockPanelShell>
<ListSurface
	title={t('settings.title')}
	subtitle={t('settings.subtitle')}
	density="comfortable"
	enableStickyToggle={true}
>
	<div class="settings-panel">
	<label>
		{t('settings.theme')}
		<select bind:value={$selectedTheme} on:change={handleThemeChange}>
			{#each availableThemes as theme}
				<option value={theme.id}>{theme.label}</option>
			{/each}
		</select>
	</label>
	<label>
		{t('settings.languageLabel')}
		<p>{t('settings.languageDesc')}</p>
		<select value={currentLocale} on:change={handleLocaleChange}>
			<option value="zh-CN">{t('settings.languageOptions.zh')}</option>
			<option value="en-US">{t('settings.languageOptions.en')}</option>
		</select>
	</label>
	<div class="toggle-row">
		<div>
			<div class="toggle-label">{t('settings.collapseLabel')}</div>
			<p>{t('settings.collapseDesc')}</p>
		</div>
		<button type="button" class:active={$collapseCoursesByName} on:click={toggleCollapseSetting}>
			{$collapseCoursesByName ? t('settings.collapseOn') : t('settings.collapseOff')}
		</button>
	</div>
	<div class="toggle-row">
		<div>
			<div class="toggle-label">{t('settings.crossCampusLabel')}</div>
			<p>{t('settings.crossCampusDesc')}</p>
		</div>
		<button type="button" class:active={$crossCampusAllowed} on:click={toggleCrossCampus}>
			{$crossCampusAllowed ? t('settings.crossCampusOn') : t('settings.crossCampusOff')}
		</button>
	</div>
	<div class="mode-row">
		<div>
			<div class="toggle-label">{t('settings.modeLabel')}</div>
			<p>{t('settings.modeDesc')}</p>
		</div>
		<div class="mode-buttons">
			<button
				type="button"
				class:active={$selectionMode === 'allowOverflowMode'}
				on:click={() => setSelectionModeSetting('allowOverflowMode')}
			>
				{t('settings.allowOverflowMode')}
			</button>
			<button
				type="button"
				class:active={$selectionMode === 'overflowSpeedRaceMode'}
				on:click={() => setSelectionModeSetting('overflowSpeedRaceMode')}
			>
				{t('settings.overflowSpeedRaceMode')}
			</button>
		</div>
	</div>
	<div class="toggle-row">
		<div>
			<div class="toggle-label">{t('settings.paginationLabel')}</div>
			<p>{t('settings.paginationDesc')}</p>
		</div>
		<div class="mode-buttons">
			<button type="button" class:active={$paginationMode === 'paged'} on:click={() => setPaginationMode('paged')}>
				{t('settings.paged')}
			</button>
			<button type="button" class:active={$paginationMode === 'continuous'} on:click={() => setPaginationMode('continuous')}>
				{t('settings.continuous')}
			</button>
		</div>
	</div>
	<div class="input-row">
		<label>
			<span>{t('settings.pageSize')}</span>
			<input type="number" min="1" value={$pageSize} on:change={(e) => setPageSize(Number((e.currentTarget as HTMLInputElement).value))} />
		</label>
		<label>
			<span>{t('settings.pageNeighbors')}</span>
			<input type="number" min="1" value={$pageNeighbors} on:change={(e) => setPageNeighbors(Number((e.currentTarget as HTMLInputElement).value))} />
		</label>
	</div>
	<div class="toggle-row">
		<div>
			<div class="toggle-label">{t('settings.weekendLabel')}</div>
			<p>{t('settings.weekendDesc')}</p>
		</div>
		<button type="button" class:active={$showWeekends} on:click={toggleWeekends}>
			{$showWeekends ? t('settings.weekendOn') : t('settings.weekendOff')}
		</button>
	</div>
</div>
</ListSurface>
</DockPanelShell>
