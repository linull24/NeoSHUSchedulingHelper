<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { CourseFilterState, CourseFilterOptions, ConflictFilterMode } from '$lib/stores/courseFilters';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import ChipGroup from '$lib/components/ChipGroup.svelte';
	import { translator } from '$lib/i18n';

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

	const fieldLabelClass =
		'flex flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)] min-w-[160px]';
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
		$filters.teachingLanguage.length || $filters.teachingMode.length
			? $filters.teachingLanguage.concat($filters.teachingMode).join(t('filters.listSeparator'))
			: t('filters.noLimit');

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
		<label class={`${fieldLabelClass} w-full`}>
			<span>{t('filters.search')}</span>
			<input
				class={`${controlClass} w-full`}
				type="search"
				placeholder={t('filters.searchPlaceholder')}
				value={$filters.keyword}
				disabled={showAdvanced}
				on:input={(e) => updateFilter('keyword', (e.currentTarget as HTMLInputElement).value)}
			/>
		</label>
	</svelte:fragment>

	<svelte:fragment slot="chips">
		<div class="flex flex-wrap gap-2">
			<Chip selectable selected={$filters.regexEnabled} disabled={showAdvanced} on:click={() => updateFilter('regexEnabled', !$filters.regexEnabled)}>
				{t('filters.regex')}
			</Chip>
			<Chip selectable selected={$filters.matchCase} disabled={showAdvanced} on:click={() => updateFilter('matchCase', !$filters.matchCase)}>
				{t('filters.caseSensitive')}
			</Chip>
			<Chip variant="accent" on:click={() => (showAdvanced = !showAdvanced)}>
				{showAdvanced ? t('filters.closeAdvanced') : t('filters.advanced')}
			</Chip>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="settings">
		<div class="flex flex-wrap gap-3">
			<label class={`${fieldLabelClass} flex-1 min-w-[200px]`}>
				<span>{t('filters.sort')}</span>
				<select
					class={`${controlClass} w-full`}
					value={$filters.sortOptionId}
					on:change={(e) => updateFilter('sortOptionId', (e.currentTarget as HTMLSelectElement).value)}
				>
					{#each options.sortOptions as opt}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
			</label>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="view-controls">
		<div class="flex w-full flex-wrap gap-3">
			<label class={fieldLabelClass}>
				<span>{t('filters.status')}</span>
				<select
					class={controlClass}
					value={$filters.displayOption}
					on:change={(e) => updateFilter('displayOption', (e.currentTarget as HTMLSelectElement).value as any)}
				>
					{#each displayOptionChoices as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label class={fieldLabelClass}>
				<span>{t('filters.conflict')}</span>
				<select
					class={controlClass}
					value={$filters.conflictMode}
					on:change={(e) => updateFilter('conflictMode', (e.currentTarget as HTMLSelectElement).value as ConflictFilterMode)}
				>
					{#each conflictOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="advanced">
		{#if showAdvanced}
			<div class="flex flex-col gap-4">
				<div class="grid gap-3 sm:grid-cols-2">
					<label class={fieldLabelClass}>
						<span>{t('filters.campus')}</span>
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
					</label>
					<label class={fieldLabelClass}>
						<span>{t('filters.college')}</span>
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
					</label>
					<label class={fieldLabelClass}>
						<span>{t('filters.major')}</span>
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
					</label>
					<label class={fieldLabelClass}>
						<span>{t('filters.specialFilter')}</span>
						<select
							class={controlClass}
							value={$filters.specialFilter}
							on:change={(e) => updateFilter('specialFilter', (e.currentTarget as HTMLSelectElement).value as any)}
						>
							<option value="all">{t('filters.specialFilterOptions.all')}</option>
							<option value="sports-only">{t('filters.specialFilterOptions.sportsOnly')}</option>
							<option value="exclude-sports">{t('filters.specialFilterOptions.excludeSports')}</option>
						</select>
					</label>
					<label class={fieldLabelClass}>
						<span>{t('filters.creditRange')}</span>
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
					</label>
					<label class={fieldLabelClass}>
						<span>{t('filters.capacityMin')}</span>
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
					</label>
				</div>

				<div class="flex flex-col gap-3">
					<button
						type="button"
						class="flex w-full items-center justify-between rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] font-medium text-[var(--app-color-fg)]"
						on:click={() => (showLangMode = !showLangMode)}
					>
						<span>{t('filters.languageMode')}</span>
						<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{languageSummary}
						</span>
					</button>
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
							<ChipGroup label={t('filters.teachingModeLabel')} class="flex flex-col gap-2">
								{#each options.teachingModes as modeOpt}
									<Chip
										selectable
										selected={$filters.teachingMode.includes(modeOpt)}
										on:click={() => {
											const set = new Set($filters.teachingMode);
											if (set.has(modeOpt)) {
												set.delete(modeOpt);
											} else {
												set.add(modeOpt);
											}
											updateFilter('teachingMode', Array.from(set));
										}}
									>
										{modeOpt}
									</Chip>
								{/each}
								<input
									class={controlClass}
									type="text"
									placeholder={t('filters.modeOtherPlaceholder')}
									value={$filters.teachingModeOther}
									on:input={(e) => updateFilter('teachingModeOther', (e.currentTarget as HTMLInputElement).value)}
								/>
							</ChipGroup>
						</div>
					{/if}

					<button
						type="button"
						class="flex w-full items-center justify-between rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] font-medium text-[var(--app-color-fg)]"
						on:click={() => (showWeekFold = !showWeekFold)}
					>
						<span>{t('filters.weekFilters')}</span>
						<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{paritySummary} / {spanSummary}
						</span>
					</button>
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
		{/if}
	</svelte:fragment>
</FilterBar>
