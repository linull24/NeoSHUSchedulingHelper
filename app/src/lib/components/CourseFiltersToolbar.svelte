<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { CourseFilterState, CourseFilterOptions, ConflictFilterMode } from '$lib/stores/courseFilters';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import ChipGroup from '$lib/components/ChipGroup.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import type { LimitMode } from '../../config/selectionFilters';
	import { hideFilterStatusControl } from '$lib/stores/courseDisplaySettings';
	import { crossCampusAllowed, homeCampus } from '$lib/stores/coursePreferences';
	import { dispatchTermAction, termState } from '$lib/stores/termStateStore';
	import { appPolicy } from '$lib/policies';
	import type { FilterScope } from '$lib/policies';
	import { ENROLLMENT_BATCH_ORDER, type EnrollmentBatchLabel } from '../../../shared/jwxtCrawler/batchPolicy';
	import { getJwxtUserBatchUiState, shouldShowBatchControlsInFilterScope } from '$lib/policies/jwxt/ui';
	import { resolveMinAcceptableBatchLabelForScope, setMinAcceptableBatchLabelOverride } from '$lib/policies/jwxt/minBatchByScope';

export let filters: Writable<CourseFilterState>;
export let options: CourseFilterOptions;
export let mode: 'all' | 'wishlist' | 'selected' = 'all';
export let statusModeScope: 'auto' | 'none' | 'all' | 'wishlist' | 'selected' | 'jwxt' = 'auto';
export let hasOrphanSelected: boolean | null = null;
export let lockConflictMode: ConflictFilterMode | null = null;

	let showAdvanced = false;
let showLangMode = false;
let showWeekFold = false;
	let appliedDefaultCampus = false;

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	const parityOptionValues = ['any', 'odd', 'even', 'all'] as const;
	const spanOptionValues = ['any', 'upper', 'lower', 'full'] as const;

	const conflictOptionValues: ConflictFilterMode[] = ['time', 'current', 'hard', 'soft'];
	const conflictLabelKey: Record<ConflictFilterMode, string> = {
		off: 'filters.conflictJudgeOptions.off',
		time: 'filters.conflictJudgeOptions.time',
		current: 'filters.conflictJudgeOptions.current',
		hard: 'filters.conflictJudgeOptions.hard',
		soft: 'filters.conflictJudgeOptions.soft'
	};

	$: viewModeLabel =
		mode === 'wishlist'
			? t('filters.viewModes.wishlist')
			: mode === 'selected'
				? t('filters.viewModes.selected')
				: t('filters.viewModes.all');

	$: effectiveStatusModeScope = statusModeScope === 'auto' ? mode : statusModeScope;

	$: statusModeChoices =
		effectiveStatusModeScope === 'none'
			? []
			: effectiveStatusModeScope === 'all'
			? [
					{ value: 'all:none', label: t('filters.statusModes.all.none') },
					{ value: 'all:no-status', label: t('filters.statusModes.all.noStatus') },
					{ value: 'all:wishlist', label: t('filters.statusModes.all.wishlist') },
					{ value: 'all:selected', label: t('filters.statusModes.all.selected') }
			  ]
			: effectiveStatusModeScope === 'jwxt'
				? [
						{ value: 'all:none', label: t('filters.statusModes.all.none') },
						{ value: 'all:no-status', label: t('filters.statusModes.all.noStatus') },
						{ value: 'all:selected', label: t('filters.statusModes.all.selected') },
						{ value: 'all:orphan-selected', label: t('filters.statusModes.all.orphanSelected') }
				  ]
			: effectiveStatusModeScope === 'wishlist'
				? [
						{ value: 'wishlist:none', label: t('filters.statusModes.wishlist.none') },
						{ value: 'wishlist:has-selected', label: t('filters.statusModes.wishlist.hasSelected') }
				  ]
				: (() => {
						const showOrphan = hasOrphanSelected ?? true;
						const base = [
							{ value: 'selected:none', label: t('filters.statusModes.selected.none') },
							{ value: 'selected:has-wishlist', label: t('filters.statusModes.selected.hasWishlist') }
						];
						return showOrphan
							? base.concat([{ value: 'selected:orphan', label: t('filters.statusModes.selected.orphan') }])
							: base;
				  })();

	$: {
		if (effectiveStatusModeScope === 'none') {
			if ($filters.statusMode !== 'all:none') {
				filters.update((current) => ({ ...current, statusMode: 'all:none' }));
			}
		} else if (statusModeChoices.length) {
			const allowed = new Set(statusModeChoices.map((choice) => choice.value));
			if (!allowed.has($filters.statusMode as any)) {
				filters.update((current) => ({ ...current, statusMode: statusModeChoices[0]?.value as any }));
			}
		}
	}

	$: conflictOptions = conflictOptionValues.map((value) => ({
		value,
		label: t(conflictLabelKey[value])
	}));

	$: if (lockConflictMode && $filters.conflictMode !== lockConflictMode) {
		filters.update((current) => ({ ...current, conflictMode: lockConflictMode }));
	}

	// Default to home campus on first render, but do not override explicit user changes later.
	$: if (!appliedDefaultCampus && !$filters.campus.trim() && $homeCampus.trim()) {
		appliedDefaultCampus = true;
		filters.update((current) => ({ ...current, campus: $homeCampus }));
	}

	// When cross-campus is disabled, lock campus filter to home campus.
	$: if (!$crossCampusAllowed && $homeCampus.trim() && $filters.campus.trim() !== $homeCampus.trim()) {
		filters.update((current) => ({ ...current, campus: $homeCampus }));
	}

	$: languageSummary =
		$filters.teachingLanguage.length
			? $filters.teachingLanguage.join(t('filters.listSeparator'))
			: t('filters.noLimit');

	let filterScope: FilterScope = 'all';
	$: filterScope = (effectiveStatusModeScope === 'jwxt' ? 'jwxt' : mode === 'all' ? 'all' : 'current') as FilterScope;
	$: abnormalRuleKeys = appPolicy.courseFilters.getPolicy(filterScope).abnormalLimitRuleKeys;
	type AbnormalFilterMode = 'default-hidden' | 'show-all' | 'only-abnormal' | 'mixed';

	function updateScopeMinBatch(scope: 'all' | 'current', raw: string) {
		if (!$termState) return;
		const trimmed = raw.trim();
		const next = trimmed === '__inherit__' ? 'inherit' : (trimmed ? (trimmed as EnrollmentBatchLabel) : null);
		const patch = setMinAcceptableBatchLabelOverride($termState, scope, next as any);
		void dispatchTermAction({ type: 'SETTINGS_UPDATE', patch });
	}

	$: abnormalFilterMode = (() => {
		const modes = abnormalRuleKeys.map((key) => $filters.limitModes[key]);
		if (modes.every((mode) => mode === undefined)) return 'default-hidden';
		if (modes.every((mode) => mode === 'default')) return 'show-all';
		if (modes.every((mode) => mode === 'only')) return 'only-abnormal';
		return 'mixed';
	})();

	$: abnormalSummary = (() => {
		switch (abnormalFilterMode) {
			case 'default-hidden':
				return t('filters.abnormalFilterSummaries.defaultHidden');
			case 'show-all':
				return t('filters.abnormalFilterSummaries.showAll');
			case 'only-abnormal':
				return t('filters.abnormalFilterSummaries.onlyAbnormal');
			default:
				return t('filters.abnormalFilterSummaries.mixed');
		}
	})();

	function setAbnormalMode(mode: Exclude<AbnormalFilterMode, 'mixed'>) {
		filters.update((current) => {
			const nextModes = { ...current.limitModes };
			if (mode === 'default-hidden') {
				abnormalRuleKeys.forEach((key) => delete nextModes[key]);
			} else {
				const target: LimitMode = mode === 'show-all' ? 'default' : 'only';
				abnormalRuleKeys.forEach((key) => {
					nextModes[key] = target;
				});
			}
			return { ...current, limitModes: nextModes };
		});
	}

	$: paritySummary = t(
		`filters.weekParitySummary.${($filters.weekParityFilter as 'any' | 'odd' | 'even' | 'all') ?? 'any'}`
	);
	$: spanSummary = t(
		`filters.weekSpanSummary.${($filters.weekSpanFilter as 'any' | 'upper' | 'lower' | 'full') ?? 'any'}`
	);
	$: parityOptionLabels = parityOptionValues.map((value) => ({
		value,
		label: t(`filters.weekParityOptions.${value}`)
	}));
	$: spanOptionLabels = spanOptionValues.map((value) => ({
		value,
		label: t(`filters.weekSpanOptions.${value}`)
	}));

		function updateFilter<K extends keyof CourseFilterState>(key: K, value: CourseFilterState[K]) {
			filters.update((current) => ({ ...current, [key]: value }));
		}

		function toggleSortOrder() {
			updateFilter('sortOrder', $filters.sortOrder === 'asc' ? 'desc' : 'asc');
		}

		$: sortOrderLabel = $filters.sortOrder === 'asc' ? t('filters.sortOrderAsc') : t('filters.sortOrderDesc');
		$: sortOrderToggleLabel = `${t('filters.sort')}: ${sortOrderLabel}`;

		function toggleAdvanced() {
			showAdvanced = !showAdvanced;
		}
	</script>

<FilterBar>
	<svelte:fragment slot="mode">
		{#if mode}
			<div class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
				{t('filters.view')}: <span class="font-medium text-[var(--app-color-fg)]">{viewModeLabel}</span>
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="simple">
		<AppField label={t('filters.search')} class="w-full">
			<input
				class="app-control w-full"
				type="search"
				placeholder={t('filters.searchPlaceholder')}
				title={t('filters.searchHelp')}
				value={$filters.keyword}
				on:input={(e) => updateFilter('keyword', (e.currentTarget as HTMLInputElement).value)}
			/>
		</AppField>
	</svelte:fragment>

	<svelte:fragment slot="chips">
		<div class="chip-row flex flex-wrap gap-2">
			<Chip selectable selected={$filters.regexEnabled} on:click={() => updateFilter('regexEnabled', !$filters.regexEnabled)}>
				{t('filters.regex')}
			</Chip>
			<Chip selectable selected={$filters.matchCase} on:click={() => updateFilter('matchCase', !$filters.matchCase)}>
				{t('filters.caseSensitive')}
			</Chip>
			<Chip
				variant="accent"
				aria-pressed={showAdvanced}
				on:pointerdown={(event) => event.stopPropagation()}
				on:mousedown={(event) => event.stopPropagation()}
				on:click={(event) => {
					event.stopPropagation();
					toggleAdvanced();
				}}
			>
				{showAdvanced ? t('filters.closeAdvanced') : t('filters.advanced')}
			</Chip>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="settings">
		<AppControlRow>
			<AppField label={t('filters.sort')} class="flex-1 min-w-[min(220px,100%)] w-auto">
				<div class="flex items-center gap-2">
					<select
						class="app-control flex-1 min-w-0"
						value={$filters.sortOptionId}
						on:change={(e) => updateFilter('sortOptionId', (e.currentTarget as HTMLSelectElement).value)}
					>
						{#each options.sortOptions as opt}
							<option value={opt.id}>{opt.label}</option>
						{/each}
					</select>
					<AppButton
						variant="secondary"
						size="sm"
						iconOnly
						title={sortOrderToggleLabel}
						aria-label={sortOrderToggleLabel}
						on:click={toggleSortOrder}
					>
						{$filters.sortOrder === 'asc' ? '↑' : '↓'}
					</AppButton>
				</div>
			</AppField>
		</AppControlRow>
	</svelte:fragment>

	<svelte:fragment slot="view-controls">
		<AppControlRow class="w-full items-end">
			{#if $termState && shouldShowBatchControlsInFilterScope($termState, filterScope)}
				{@const userBatchUi = getJwxtUserBatchUiState($termState)}
				{@const scopeKey = (filterScope === 'current' ? 'current' : 'all') as any}
				{@const effectiveMin = resolveMinAcceptableBatchLabelForScope($termState, scopeKey)}
				<div class="flex-1 min-w-[min(220px,100%)] w-auto text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{#if userBatchUi.kind === 'need-userscript'}
						{t('panels.jwxt.userBatchNeedUserscript')}
					{:else if userBatchUi.kind === 'missing'}
						{t('panels.jwxt.userBatchMissing')}
					{/if}
				</div>
				<AppField label={t('settings.minAcceptableBatchLabel')} class="flex-1 min-w-[min(220px,100%)] w-auto">
					<select
						class="app-control w-full"
						value={(($termState.settings.jwxt as any).minAcceptableBatchLabelOverrides?.[scopeKey] ?? '__inherit__') as any}
						on:change={(event) => updateScopeMinBatch(scopeKey, String((event.currentTarget as HTMLSelectElement).value || ''))}
					>
						<option value="__inherit__">{t('filters.displayOptions.all')}</option>
						<option value="">{t('settings.minAcceptableBatchOff')}</option>
						{#each ENROLLMENT_BATCH_ORDER as label (label)}
							<option value={label}>
								{label}{effectiveMin === label ? ' ✓' : ''}
							</option>
						{/each}
					</select>
				</AppField>
			{/if}

			{#if !$hideFilterStatusControl && effectiveStatusModeScope !== 'none' && statusModeChoices.length}
				<AppField label={t('filters.status')} class="flex-1 min-w-[min(220px,100%)] w-auto">
					<select
						class="app-control w-full"
						value={$filters.statusMode}
						on:change={(e) => updateFilter('statusMode', (e.currentTarget as HTMLSelectElement).value as any)}
					>
						{#each statusModeChoices as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</AppField>
			{/if}
			{#if $crossCampusAllowed}
				<AppField label={t('filters.campus')} class="flex-1 min-w-[min(220px,100%)] w-auto">
					<select
						class="app-control w-full"
						value={$filters.campus}
						on:change={(e) => updateFilter('campus', (e.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">{t('filters.displayOptions.all')}</option>
						{#each options.campuses as campus}
							<option value={campus}>{campus}</option>
						{/each}
					</select>
				</AppField>
			{/if}
			<AppField label={t('filters.conflict')} class="flex-1 min-w-[min(220px,100%)] w-auto">
				<select
					class="app-control w-full"
					disabled={Boolean(lockConflictMode)}
					value={lockConflictMode ?? $filters.conflictMode}
					on:change={(e) => {
						if (lockConflictMode) return;
						updateFilter('conflictMode', (e.currentTarget as HTMLSelectElement).value as ConflictFilterMode);
					}}
				>
					{#each conflictOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</AppField>
			<Chip
				selectable
				selected={$filters.showConflictBadges}
				class="flex-[0_0_auto]"
				on:click={() => updateFilter('showConflictBadges', !$filters.showConflictBadges)}
			>
				{t('filters.showConflictBadges')}
			</Chip>
		</AppControlRow>
	</svelte:fragment>

	<svelte:fragment slot="advanced" />
</FilterBar>

{#if showAdvanced}
		<button
			type="button"
			class="fixed inset-0 z-[5000] cursor-default bg-[color:var(--app-color-bg)]/60 backdrop-blur-[2px] focus-visible:outline-none"
			aria-label={t('filters.closeAdvanced')}
			on:click={() => (showAdvanced = false)}
		></button>
	<div class="fixed inset-0 z-[5001] flex items-start justify-center overflow-auto p-6 pointer-events-none">
		<div
			class="pointer-events-auto flex w-full max-w-5xl flex-col gap-4 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-6 shadow-[var(--app-shadow-hard)]"
			role="dialog"
			aria-modal="true"
			aria-label={t('filters.advanced')}
		>
			<div class="flex items-center justify-between gap-4">
				<h4 class="m-0 text-[var(--app-text-lg)] font-semibold text-[var(--app-color-fg)]">
					{t('filters.advanced')}
				</h4>
				<AppButton variant="secondary" size="sm" on:click={() => (showAdvanced = false)}>
					{t('filters.closeAdvanced')}
				</AppButton>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<AppField label={t('filters.campus')}>
					<div title={!$crossCampusAllowed ? t('filters.campusLockedHint') : undefined}>
						<select
							disabled={!$crossCampusAllowed}
							class={`app-control ${!$crossCampusAllowed ? 'cursor-not-allowed opacity-60' : ''}`}
							value={$filters.campus}
							on:change={(e) => updateFilter('campus', (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">{t('filters.displayOptions.all')}</option>
							{#each options.campuses as campus}
								<option value={campus}>{campus}</option>
							{/each}
						</select>
					</div>
					{#if !$crossCampusAllowed}
						<div class="mt-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('filters.campusLockedHint')}
						</div>
					{/if}
				</AppField>
				<AppField label={t('filters.college')}>
					<select
						class="app-control"
						value={$filters.college}
						on:change={(e) => updateFilter('college', (e.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">{t('filters.displayOptions.all')}</option>
						{#each options.colleges as college}
							<option value={college}>{college}</option>
						{/each}
					</select>
				</AppField>
				<AppField label={t('filters.specialFilter')}>
					<select
						class="app-control"
						value={$filters.specialFilter}
						on:change={(e) => updateFilter('specialFilter', (e.currentTarget as HTMLSelectElement).value as any)}
					>
						<option value="all">{t('filters.specialFilterOptions.all')}</option>
						<option value="sports-only">{t('filters.specialFilterOptions.sportsOnly')}</option>
						<option value="exclude-sports">{t('filters.specialFilterOptions.excludeSports')}</option>
					</select>
				</AppField>
				{#if options.specialTags.length}
					<ChipGroup label={t('filters.specialTagsLabel')} class="flex flex-col gap-2">
						<div class="flex flex-wrap gap-2">
							{#each options.specialTags as tag (tag)}
								<Chip
									selectable
									selected={$filters.specialTags.includes(tag)}
									on:click={() => {
										const set = new Set($filters.specialTags);
										if (set.has(tag)) {
											set.delete(tag);
										} else {
											set.add(tag);
										}
										updateFilter('specialTags', Array.from(set));
									}}
								>
									{tag}
								</Chip>
							{/each}
						</div>
					</ChipGroup>
				{/if}
				<AppField label={t('filters.creditRange')}>
					<div class="flex items-center gap-2">
						<input
							class="app-control flex-1"
							type="number"
							min="0"
							placeholder={t('filters.minPlaceholder')}
							value={$filters.minCredit ?? ''}
							on:input={(e) =>
								updateFilter(
									'minCredit',
									(e.currentTarget as HTMLInputElement).value
										? Number((e.currentTarget as HTMLInputElement).value)
										: null
								)}
						/>
						<span class="text-[var(--app-color-fg-muted)]">—</span>
						<input
							class="app-control flex-1"
							type="number"
							min="0"
							placeholder={t('filters.maxPlaceholder')}
							value={$filters.maxCredit ?? ''}
							on:input={(e) =>
								updateFilter(
									'maxCredit',
									(e.currentTarget as HTMLInputElement).value
										? Number((e.currentTarget as HTMLInputElement).value)
										: null
								)}
						/>
					</div>
				</AppField>
				<AppField label={t('filters.capacityMin')}>
					<input
						class="app-control"
						type="number"
						min="0"
						value={$filters.capacityMin ?? ''}
						on:input={(e) =>
							updateFilter(
							 'capacityMin',
							 (e.currentTarget as HTMLInputElement).value
								 ? Number((e.currentTarget as HTMLInputElement).value)
								 : null
							)}
					/>
				</AppField>
			</div>

				<div class="flex flex-col gap-3">
					<AppButton variant="secondary" size="sm" class="w-full justify-between px-3" on:click={() => (showLangMode = !showLangMode)}>
						<span>{t('filters.languageMode')}</span>
						<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{languageSummary}
						</span>
					</AppButton>
					{#if showLangMode}
						<div class="grid gap-3 sm:grid-cols-2">
							<ChipGroup label={t('filters.teachingLanguageLabel')} class="flex flex-col gap-2">
								{#each options.teachingLanguages as lang}
									<Chip
										selectable
										selected={$filters.teachingLanguage.includes(lang)}
										on:click={() => {
											const set = new Set($filters.teachingLanguage);
											if (set.has(lang)) {
												set.delete(lang);
											} else {
												set.add(lang);
											}
											updateFilter('teachingLanguage', Array.from(set));
										}}
									>
										{lang}
									</Chip>
								{/each}
							</ChipGroup>
							<AppField label={t('filters.teachingModeLabel')} class="w-full">
								<select
									class="app-control w-full"
									value={abnormalFilterMode}
									on:change={(e) => {
										const value = (e.currentTarget as HTMLSelectElement).value as AbnormalFilterMode;
										if (value !== 'mixed') setAbnormalMode(value);
									}}
								>
									<option value="default-hidden">{t('filters.abnormalFilterOptions.defaultHidden')}</option>
									<option value="show-all">{t('filters.abnormalFilterOptions.showAll')}</option>
									<option value="only-abnormal">{t('filters.abnormalFilterOptions.onlyAbnormal')}</option>
									<option value="mixed" disabled>{t('filters.abnormalFilterOptions.mixed')}</option>
								</select>
								<div class="mt-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{abnormalSummary}</div>
							</AppField>
						</div>
					{/if}

						<AppButton variant="secondary" size="sm" class="w-full justify-between px-3" on:click={() => (showWeekFold = !showWeekFold)}>
							<span>{t('filters.weekFilters')}</span>
							<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{paritySummary} / {spanSummary}
							</span>
						</AppButton>
					{#if showWeekFold}
						<div class="grid gap-3 sm:grid-cols-2">
							<ChipGroup label={t('filters.weekParityLabel')} class="flex flex-col gap-2">
								{#each parityOptionLabels as option}
									<Chip selectable selected={$filters.weekParityFilter === option.value} on:click={() => updateFilter('weekParityFilter', option.value as any)}>
										{option.label}
									</Chip>
								{/each}
							</ChipGroup>
							<ChipGroup label={t('filters.weekSpanLabel')} class="flex flex-col gap-2">
								{#each spanOptionLabels as option}
									<Chip selectable selected={$filters.weekSpanFilter === option.value} on:click={() => updateFilter('weekSpanFilter', option.value as any)}>
										{option.label}
									</Chip>
								{/each}
							</ChipGroup>
						</div>
					{/if}
				</div>
		</div>
	</div>
{/if}

<style>
	:global(.filter-field) input,
	:global(.filter-field) select {
		min-width: 0;
	}

	@container panel-shell (max-width: 640px) {
		:global(.filter-field) {
			min-width: 0 !important;
			width: 100%;
		}

		:global(.filter-field) input,
		:global(.filter-field) select {
			width: 100%;
		}
	}

	@container panel-shell (max-width: 520px) {
		.chip-row {
			width: 100%;
		}

		.chip-row :global(button) {
			flex: 1 1 160px;
			justify-content: center;
		}
	}
</style>
