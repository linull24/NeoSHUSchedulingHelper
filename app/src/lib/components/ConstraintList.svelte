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
	import ListSurface from '$lib/components/ListSurface.svelte';

	export let title: string;
	export let items: ConstraintItem[] = [];
	export let onRemove: (item: ConstraintItem) => void;
	export let onConvert: ((item: ConstraintItem) => void) | undefined = undefined;
	export let primaryActionLabel: string | undefined = undefined;
	export let secondaryActionLabel: string | undefined = undefined;
	export let onPrimaryAction: (() => void) | undefined = undefined;
	export let onSecondaryAction: (() => void) | undefined = undefined;
	export let convertibleKinds: Array<ConstraintItem['kind']> | null = null;
	export let searchPlaceholder = '搜索约束';

	let query = '';
	let filterVersion = 0;

	const typeFilters = new Set<string>();
	const priorityFilters = new Set<string>();
	const directionFilters = new Set<string>();
	const statusFilters = new Set<string>();
	const sourceFilters = new Set<string>();

	const filterGroups: Array<{
		key: 'type' | 'priority' | 'direction' | 'status' | 'source';
		label: string;
		options: Array<{ label: string; value: string }>;
		set: Set<string>;
	}> = [
		{
			key: 'type',
			label: '类型',
			options: [
				{ label: '组', value: 'group' },
				{ label: '班次', value: 'section' },
				{ label: '时间', value: 'time' },
				{ label: '课程', value: 'course' },
				{ label: '教师', value: 'teacher' },
				{ label: '自定义', value: 'custom' }
			],
			set: typeFilters
		},
		{
			key: 'priority',
			label: '优先级',
			options: [
				{ label: '硬', value: 'hard' },
				{ label: '软', value: 'soft' }
			],
			set: priorityFilters
		},
		{
			key: 'direction',
			label: '方向',
			options: [
				{ label: '包含', value: 'include' },
				{ label: '排除', value: 'exclude' }
			],
			set: directionFilters
		},
		{
			key: 'status',
			label: '状态',
			options: [
				{ label: '启用', value: 'enabled' },
				{ label: '禁用', value: 'disabled' }
			],
			set: statusFilters
		},
		{
			key: 'source',
			label: '来源',
			options: [
				{ label: '列表按钮', value: 'list' },
				{ label: '求解器', value: 'solver' },
				{ label: '导入', value: 'imported' }
			],
			set: sourceFilters
		}
	];

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

<ListSurface title={title} count={items.length}>
	<svelte:fragment slot="header-actions">
		{#if primaryActionLabel || secondaryActionLabel}
			<div class="constraint-actions">
				{#if secondaryActionLabel}
					<button type="button" class="ghost" on:click={onSecondaryAction}>
						{secondaryActionLabel}
					</button>
				{/if}
				{#if primaryActionLabel}
					<button type="button" class="primary" on:click={onPrimaryAction}>
						{primaryActionLabel}
					</button>
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<div slot="search" class="constraint-search">
		<input type="search" placeholder={searchPlaceholder} bind:value={query} aria-label="搜索约束" />
	</div>

	<div slot="filters" class="constraint-filters">
		{#each filterGroups as group (group.key)}
			<div class="chip-group">
				<span class="chip-label">{group.label}</span>
				<div class="chip-list">
					{#each group.options as option (option.value)}
						<button
							type="button"
							class:active={group.set.has(option.value)}
							on:click={() => toggleChip(group.key, option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if !filtered.length}
		<p class="muted constraint-empty">暂无约束</p>
	{:else}
		<ul class="constraint-items">
			{#each filtered as item (item.id)}
				<li>
					<div class="meta">
						<div class="label">
							<strong>{item.label}</strong>
							{#if item.detail}<small>{item.detail}</small>{/if}
						</div>
						<div class="tags">
							<span class={`pill ${item.priority === 'hard' ? 'hard' : 'soft'}`}>
								{item.priority === 'hard' ? '硬' : '软'}
							</span>
							{#if item.direction}
								<span class="pill secondary">{item.direction === 'include' ? '包含' : '排除'}</span>
							{/if}
							{#if item.type}
								<span class="pill secondary">{item.type === 'group' ? '组' : item.type}</span>
							{/if}
							{#if item.status}
								<span class="pill secondary">{item.status === 'disabled' ? '禁用' : '启用'}</span>
							{/if}
							{#if item.source}
								<span class="pill secondary">{item.source === 'list' ? '列表按钮' : item.source === 'solver' ? '求解器' : '导入'}</span>
							{/if}
							{#if item.tags}
								{#each item.tags as tag}
									<span class="pill secondary">{tag}</span>
								{/each}
							{/if}
							{#if typeof item.weight === 'number'}
								<span class="pill secondary">权重 {item.weight}</span>
							{/if}
						</div>
					</div>
					<div class="actions">
						{#if onConvert && (!convertibleKinds || convertibleKinds.includes(item.kind))}
							<button type="button" class="ghost" on:click={() => onConvert?.(item)}>
								转为{item.priority === 'hard' ? '软' : '硬'}
							</button>
						{/if}
						<button type="button" class="danger" on:click={() => onRemove(item)}>移除</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</ListSurface>

<style src="$lib/styles/constraint-list.scss" lang="scss"></style>
