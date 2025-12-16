<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { CourseFilterState, CourseFilterOptions, ConflictFilterMode } from '$lib/stores/courseFilters';
import FilterBar from '$lib/components/FilterBar.svelte';
import Chip from '$lib/components/Chip.svelte';
	import ChipGroup from '$lib/components/ChipGroup.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import { translator } from '$lib/i18n';
	import type { LimitMode, LimitRuleKey } from '../../config/selectionFilters';

export let filters: Writable<CourseFilterState>;
export let options: CourseFilterOptions;
export let mode: 'all' | 'wishlist' | 'selected' = 'all';

	let showAdvanced = false;
let showLangMode = false;
let showWeekFold = false;

	let t = (key: string) => key;
	$: t = $translator;

	const parityOptionValues = ['any', 'odd', 'even', 'all'] as const;
	const spanOptionValues = ['any', 'upper', 'lower', 'full'] as const;

	const conflictOptionValues: ConflictFilterMode[] = [
		'any',
		'no-conflict',
		'no-time-conflict',
		'no-hard-conflict',
		'no-impossible'
	];
	const conflictLabelKey: Record<ConflictFilterMode, string> = {
		any: 'filters.conflictOptions.any',
		'no-conflict': 'filters.conflictOptions.noAnyConflict',
		'no-time-conflict': 'filters.conflictOptions.noTimeConflict',
		'no-hard-conflict': 'filters.conflictOptions.noHardConstraintConflict',
		'no-impossible': 'filters.conflictOptions.noUnavoidableConflict'
	};

	const controlClass =
		'h-9 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 text-[var(--app-color-fg)] outline-none transition-shadow focus:ring-2 focus:ring-[color:var(--app-color-primary)] focus:ring-offset-0';

	$: viewModeLabel =
		mode === 'wishlist'
			? t('filters.viewModes.wishlist')
			: mode === 'selected'
				? t('filters.viewModes.selected')
				: t('filters.viewModes.all');

	$: displayOptionChoices =
		mode === 'selected'
			? [
					{ value: 'all', label: t('filters.displayOptions.all') },
					{ value: 'unselected', label: t('filters.displayOptions.selectedPending') },
					{ value: 'selected', label: t('filters.displayOptions.selectedChosen') }
			  ]
			: [
					{ value: 'all', label: t('filters.displayOptions.all') },
					{ value: 'unselected', label: t('filters.displayOptions.wishlistPending') },
					{ value: 'selected', label: t('filters.displayOptions.wishlistSelected') }
			  ];

	$: conflictOptions = conflictOptionValues.map((value) => ({
		value,
		label: t(conflictLabelKey[value])
	}));

	$: languageSummary =
		$filters.teachingLanguage.length
			? $filters.teachingLanguage.join(t('filters.listSeparator'))
			: t('filters.noLimit');

	const abnormalRuleKeys: LimitRuleKey[] = ['selectionForbidden', 'locationClosed', 'classClosed'];
	type AbnormalFilterMode = 'default-hidden' | 'show-all' | 'only-abnormal' | 'mixed';

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
				class={`${controlClass} w-full`}
				type="search"
				placeholder={t('filters.searchPlaceholder')}
				value={$filters.keyword}
				disabled={showAdvanced}
				on:input={(e) => updateFilter('keyword', (e.currentTarget as HTMLInputElement).value)}
			/>
		</AppField>
	</svelte:fragment>

	<svelte:fragment slot="chips">
		<div class="flex flex-wrap gap-2">
			<Chip selectable selected={$filters.regexEnabled} disabled={showAdvanced} on:click={() => updateFilter('regexEnabled', !$filters.regexEnabled)}>
				{t('filters.regex')}
			</Chip>
			<Chip selectable selected={$filters.matchCase} disabled={showAdvanced} on:click={() => updateFilter('matchCase', !$filters.matchCase)}>
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
			<AppField label={t('filters.sort')} class="flex-1 min-w-[200px]">
				<select
					class={`${controlClass} w-full`}
					value={$filters.sortOptionId}
					on:change={(e) => updateFilter('sortOptionId', (e.currentTarget as HTMLSelectElement).value)}
				>
					{#each options.sortOptions as opt}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
			</AppField>
		</AppControlRow>
	</svelte:fragment>

	<svelte:fragment slot="view-controls">
		<AppControlRow class="w-full">
			<AppField label={t('filters.status')} class="min-w-[160px]">
				<select
					class={controlClass}
					value={$filters.displayOption}
					on:change={(e) => updateFilter('displayOption', (e.currentTarget as HTMLSelectElement).value as any)}
				>
					{#each displayOptionChoices as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</AppField>
			<AppField label={t('filters.conflict')} class="min-w-[160px]">
				<select
					class={controlClass}
					value={$filters.conflictMode}
					on:change={(e) => updateFilter('conflictMode', (e.currentTarget as HTMLSelectElement).value as ConflictFilterMode)}
				>
					{#each conflictOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</AppField>
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
					<select
						class={controlClass}
						value={$filters.campus}
						on:change={(e) => updateFilter('campus', (e.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">{t('filters.displayOptions.all')}</option>
						{#each options.campuses as campus}
							<option value={campus}>{campus}</option>
						{/each}
					</select>
				</AppField>
				<AppField label={t('filters.college')}>
					<select
						class={controlClass}
						value={$filters.college}
						on:change={(e) => updateFilter('college', (e.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">{t('filters.displayOptions.all')}</option>
						{#each options.colleges as college}
							<option value={college}>{college}</option>
						{/each}
					</select>
				</AppField>
				<AppField label={t('filters.major')}>
					<select
						class={controlClass}
						value={$filters.major}
						on:change={(e) => updateFilter('major', (e.currentTarget as HTMLSelectElement).value)}
					>
						<option value="">{t('filters.displayOptions.all')}</option>
						{#each options.majors as major}
							<option value={major}>{major}</option>
						{/each}
					</select>
				</AppField>
				<AppField label={t('filters.specialFilter')}>
					<select
						class={controlClass}
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
							class={`${controlClass} flex-1`}
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
							class={`${controlClass} flex-1`}
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
						class={controlClass}
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
									class={`${controlClass} w-full`}
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
	:global(.filter-field input),
	:global(.filter-field select),
	:global(.filter-field textarea) {
		min-width: 0;
	}

	@container panel-shell (max-width: 640px) {
		:global(.filter-field) {
			min-width: 0 !important;
			width: 100%;
		}

		:global(.filter-field input),
		:global(.filter-field select),
		:global(.filter-field textarea) {
			width: 100%;
		}
	}
</style>
