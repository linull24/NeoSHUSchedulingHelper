<script context="module" lang="ts">
	export type ConstraintItem = {
		id: string;
		label: string;
		detail?: string;
		tags?: string[];
		type?: 'group' | 'section' | 'time' | 'course' | 'teacher' | 'custom';
		kind?: 'lock' | 'soft';
		status?: 'enabled' | 'disabled';
		source?: 'list' | 'solver' | 'imported';
		priority: 'hard' | 'soft';
		direction?: 'include' | 'exclude';
		weight?: number;
	};
</script>

<script lang="ts">
	import AppListCard from '$lib/components/AppListCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import { dictionary as dictionaryStore, translator } from '$lib/i18n';
	import type { Dictionary } from '$lib/i18n';

	export let items: ConstraintItem[] = [];
	export let onRemove: (item: ConstraintItem) => void;
	export let onConvert: ((item: ConstraintItem) => void) | undefined = undefined;
	export let primaryActionLabel: string | undefined = undefined;
	export let secondaryActionLabel: string | undefined = undefined;
	export let onPrimaryAction: (() => void) | undefined = undefined;
	export let onSecondaryAction: (() => void) | undefined = undefined;
	export let convertibleKinds: Array<ConstraintItem['kind']> | null = null;
	export let searchPlaceholder: string | undefined = undefined;

	let query = '';
	let filterVersion = 0;

	const typeFilters = new Set<string>();
	const priorityFilters = new Set<string>();
	const directionFilters = new Set<string>();
	const statusFilters = new Set<string>();
	const sourceFilters = new Set<string>();

	const defaultConstraintTypeLabels = {
		group: 'Group',
		section: 'Section',
		time: 'Time',
		course: 'Course',
		teacher: 'Teacher',
		custom: 'Custom'
	};

	type ConstraintTypeKey = keyof typeof defaultConstraintTypeLabels;
	const constraintTypeOrder: ConstraintTypeKey[] = ['group', 'section', 'time', 'course', 'teacher', 'custom'];

	let t = (key: string) => key;
	let dict: Dictionary | null = null;
	let resolvedSearchPlaceholder = 'Search constraints';
	let constraintTypeLabels = defaultConstraintTypeLabels;
	let filterGroups: Array<{
		key: 'type' | 'priority' | 'direction' | 'status' | 'source';
		label: string;
		options: Array<{ label: string; value: string }>;
		set: Set<string>;
	}> = [];

$: t = $translator;
$: dict = $dictionaryStore as Dictionary;
	$: resolvedSearchPlaceholder = searchPlaceholder ?? t('panels.solver.searchConstraints');
	$: constraintTypeLabels = dict?.panels.solver.constraintTypeLabels ?? defaultConstraintTypeLabels;
	$: filterGroups = [
		{
			key: 'type',
			label: t('panels.solver.constraintType'),
			options: constraintTypeOrder.map((value) => ({
				value,
				label: constraintTypeLabels[value]
			})),
			set: typeFilters
		},
		{
			key: 'priority',
			label: t('panels.solver.constraintPriority'),
			options: [
				{ label: t('dropdowns.hard'), value: 'hard' },
				{ label: t('dropdowns.soft'), value: 'soft' }
			],
			set: priorityFilters
		},
		{
			key: 'direction',
			label: t('panels.solver.constraintDirection'),
			options: [
				{ label: t('dropdowns.include'), value: 'include' },
				{ label: t('dropdowns.exclude'), value: 'exclude' }
			],
			set: directionFilters
		},
		{
			key: 'status',
			label: t('panels.solver.constraintStatus'),
			options: [
				{ label: t('dropdowns.enabled'), value: 'enabled' },
				{ label: t('dropdowns.disabled'), value: 'disabled' }
			],
			set: statusFilters
		},
		{
			key: 'source',
			label: t('panels.solver.constraintSource'),
			options: [
				{ label: t('dropdowns.listSource'), value: 'list' },
				{ label: t('dropdowns.solverSource'), value: 'solver' },
				{ label: t('dropdowns.importSource'), value: 'imported' }
			],
			set: sourceFilters
		}
	];

	const pillBaseClass =
		'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[var(--app-text-xs)] bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_90%,var(--app-color-fg)_10%)] text-[var(--app-color-fg)]';
	const hardPillClass =
		'bg-[color-mix(in_srgb,var(--app-color-primary)_15%,var(--app-color-bg))] text-[var(--app-color-primary)]';
	const softPillClass =
		'bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg))] text-[var(--app-color-danger)]';

	const getTypeLabel = (type?: ConstraintItem['type']) => {
		if (!type) return '';
		return constraintTypeLabels[type as ConstraintTypeKey] ?? type;
	};

	const getSourceLabel = (source?: ConstraintItem['source']) => {
		if (!source) return '';
		if (source === 'list') return t('dropdowns.listSource');
		if (source === 'solver') return t('dropdowns.solverSource');
		if (source === 'imported') return t('dropdowns.importSource');
		return source;
	};

	function toggleChip(groupKey: typeof filterGroups[number]['key'], value: string) {
		const group = filterGroups.find((g) => g.key === groupKey);
		if (!group) return;
		if (group.set.has(value)) {
			group.set.delete(value);
		} else {
			group.set.add(value);
		}
		filterVersion += 1;
	}

	const matchesChip = (set: Set<string>, value?: string) => !set.size || (value ? set.has(value) : false);

	$: filtered = (() => {
		// depend on filterVersion to rerun when chips mutate
		filterVersion;
		return items
			.filter((item) => matchesChip(typeFilters, item.type))
			.filter((item) => matchesChip(priorityFilters, item.priority))
			.filter((item) => matchesChip(directionFilters, item.direction))
			.filter((item) => matchesChip(statusFilters, item.status ?? 'enabled'))
			.filter((item) => matchesChip(sourceFilters, item.source ?? 'list'))
			.filter((item) =>
				query
					? item.label.includes(query) ||
					  item.detail?.includes(query) ||
					  item.tags?.some((tag) => tag.includes(query))
					: true
			);
	})();
</script>

<div class="flex flex-col gap-3 min-w-0">
	{#if primaryActionLabel || secondaryActionLabel}
		<CardActionBar class="justify-start">
			{#if secondaryActionLabel}
				<AppButton variant="secondary" size="sm" on:click={() => onSecondaryAction?.()}>
					{secondaryActionLabel}
				</AppButton>
			{/if}
			{#if primaryActionLabel}
				<AppButton variant="primary" size="sm" on:click={() => onPrimaryAction?.()}>
					{primaryActionLabel}
				</AppButton>
			{/if}
		</CardActionBar>
	{/if}

	<div class="w-full min-w-0">
		<input
			type="search"
			class="w-full min-w-0 max-w-[420px] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)] placeholder:text-[var(--app-color-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--app-color-bg)]"
			placeholder={resolvedSearchPlaceholder}
			bind:value={query}
			aria-label={resolvedSearchPlaceholder}
		/>
	</div>

	<div class="flex flex-col gap-3">
		{#each filterGroups as group (group.key)}
			<div class="flex flex-col gap-1.5">
				<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{group.label}</span>
				<div class="flex flex-wrap gap-2">
					{#each group.options as option (option.value)}
						<Chip
							selectable
							selected={group.set.has(option.value)}
							variant={group.set.has(option.value) ? 'accent' : 'default'}
							on:click={() => toggleChip(group.key, option.value)}
						>
							{option.label}
						</Chip>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if !filtered.length}
		<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintEmpty')}</p>
	{:else}
		<ul class="flex list-none flex-col gap-3 p-0">
			{#each filtered as item (item.id)}
				<li>
					<AppListCard
						title={item.label}
						subtitle={item.detail ?? null}
						class="lg:flex-row lg:items-start lg:justify-between"
					>
						<div slot="meta" class="flex flex-wrap gap-2 pt-1">
							<span class={`${pillBaseClass} ${item.priority === 'hard' ? hardPillClass : softPillClass}`}>
								{item.priority === 'hard' ? t('dropdowns.hard') : t('dropdowns.soft')}
							</span>
							{#if item.direction}
								<span class={pillBaseClass}>
									{item.direction === 'include' ? t('dropdowns.include') : t('dropdowns.exclude')}
								</span>
							{/if}
							{#if item.type}
								<span class={pillBaseClass}>{getTypeLabel(item.type)}</span>
							{/if}
							{#if item.status}
								<span class={pillBaseClass}>
									{item.status === 'disabled' ? t('dropdowns.disabled') : t('dropdowns.enabled')}
								</span>
							{/if}
							{#if item.source}
								<span class={pillBaseClass}>{getSourceLabel(item.source)}</span>
							{/if}
							{#if item.tags}
								{#each item.tags as tag}
									<span class={pillBaseClass}>{tag}</span>
								{/each}
							{/if}
							{#if typeof item.weight === 'number'}
								<span class={pillBaseClass}>
									{t('panels.solver.quickWeight')} {item.weight}
								</span>
							{/if}
						</div>
						<CardActionBar slot="actions" class="justify-end">
							{#if onConvert && (!convertibleKinds || convertibleKinds.includes(item.kind))}
								<AppButton variant="secondary" size="sm" on:click={() => onConvert?.(item)}>
									{item.priority === 'hard'
										? t('panels.solver.convertToSoft')
										: t('panels.solver.convertToHard')}
								</AppButton>
							{/if}
							<AppButton
								variant="secondary"
								size="sm"
								class="text-[var(--app-color-danger)] border-[color:var(--app-color-danger)]"
								on:click={() => onRemove(item)}
							>
								{t('panels.solver.removeConstraint')}
							</AppButton>
						</CardActionBar>
					</AppListCard>
				</li>
			{/each}
		</ul>
	{/if}
</div>
