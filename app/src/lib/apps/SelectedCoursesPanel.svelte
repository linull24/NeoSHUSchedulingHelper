<svelte:options runes={false} />

<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import PaginationFooter from '$lib/components/PaginationFooter.svelte';
	import { translator } from '$lib/i18n';
	import { crossCampusAllowed } from '$lib/stores/coursePreferences';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { groupCoursesByName } from '$lib/utils/courseHelpers';
	import { courseCatalogMap } from '$lib/data/catalog/courseCatalog';
	import {
		collapseByName,
		selectedCourses,
		expandedGroups,
		filters,
		filterMeta,
		handleHover,
		handleLeave,
		toggleGroup,
		reselectCourse,
		deselectCourse,
		variantsCount
	} from './SelectedCoursesPanel.state';

	let currentPage = 1;
	let loadedCount = 0;
	let lastMode: 'paged' | 'continuous' | null = null;
	let contentSignature = '';
	let showPaginationFooter = false;

	let t = (key: string) => key;
	$: t = $translator;

	const groupHeaderClass =
		'flex w-full items-center justify-between px-4 py-3 text-left text-[var(--app-color-fg)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]';
	const variantActionsClass =
		'mt-3 flex flex-wrap items-center gap-2 rounded-[var(--app-radius-md)] bg-[var(--app-color-bg-muted)] px-3 py-2 text-[var(--app-text-sm)]';
	const variantButtonClass =
		'inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--app-color-bg)_94%,#000)]';
	const variantDangerButtonClass = `${variantButtonClass} border-[color:var(--app-color-danger)] text-[var(--app-color-danger)]`;
	const scrollContainerClass =
		'h-full min-h-[240px] overflow-auto rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]';

	$: pageSizeValue = Math.max(1, $pageSize || 1);
	$: totalItems = $selectedCourses.length;
	$: totalPages = Math.max(1, Math.ceil(totalItems / pageSizeValue));
	$: showPaginationFooter = $paginationMode === 'paged' && totalPages > 1;

	$: {
		const sig = `${totalItems}`;
		if (sig !== contentSignature) {
			contentSignature = sig;
			currentPage = 1;
			loadedCount = pageSizeValue;
		}
	}

	$: if ($paginationMode !== lastMode) {
		if ($paginationMode === 'continuous') {
			loadedCount = Math.min(totalItems, Math.max(pageSizeValue, currentPage * pageSizeValue));
		} else {
			currentPage = Math.max(1, Math.ceil(Math.max(1, loadedCount) / pageSizeValue));
		}
		lastMode = $paginationMode;
	}

	$: visibleCourses =
		$paginationMode === 'paged'
			? $selectedCourses.slice((currentPage - 1) * pageSizeValue, currentPage * pageSizeValue)
			: $selectedCourses.slice(0, Math.min(totalItems, loadedCount));

	$: grouped = $collapseByName
		? Array.from(groupCoursesByName(visibleCourses).entries()).sort((a, b) => a[0].localeCompare(b[0]))
		: [];

	function handlePageChange(page: number) {
		currentPage = Math.max(1, Math.min(totalPages, page));
	}

	function handleScroll(event: Event) {
		if ($paginationMode !== 'continuous') return;
		const target = event.currentTarget as HTMLElement;
		const { scrollTop, scrollHeight, clientHeight } = target;
		if (scrollHeight - scrollTop - clientHeight < 120) {
			loadedCount = Math.min(totalItems, loadedCount + pageSizeValue);
		}
	}

	const formatVariantCount = (count: number) =>
		t('panels.allCourses.variantCountLabel').replace('{count}', String(count));

	function describeConflict(courseId: string) {
		const meta = $filterMeta.get(courseId);
		if (!meta || meta.conflict === 'none') return null;
		const divider = t('panels.common.conflictDivider');
		if (meta.diagnostics.length) {
			return meta.diagnostics
				.map((d) => (d.reason ? `${d.label}${divider}${d.reason}` : d.label))
				.join(t('panels.common.conflictListSeparator'));
		}
		const targets = meta.conflictTargets
			.map((id) => courseCatalogMap.get(id)?.title ?? id)
			.join(t('panels.common.conflictNameSeparator'));
		const prefix =
			meta.conflict === 'hard-conflict'
				? t('panels.common.conflictHard')
				: t('panels.common.conflictTime');
		return targets ? `${prefix}${divider}${targets}` : prefix;
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.selected.title')}
		subtitle={t('panels.selected.description')}
		count={totalItems}
		density="comfortable"
		enableStickyToggle={true}
		bodyScrollable={false}
	>
		<svelte:fragment slot="filters">
			<CourseFiltersToolbar {filters} options={filterOptions} mode="selected" />
		</svelte:fragment>

		<div class={scrollContainerClass} on:scroll={handleScroll}>
			{#if $collapseByName}
				{#if grouped.length === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.selected.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each grouped as [groupKey, courses], groupIndex (groupKey)}
							{@const primary = courses[0]}
							{@const expanded = $expandedGroups.has(groupKey)}
							<article class={`flex flex-col ${expanded ? 'bg-[var(--app-color-bg-muted)]' : 'bg-transparent'}`}>
								<button type="button" class={groupHeaderClass} on:click={() => toggleGroup(groupKey)}>
									<div class="flex flex-col gap-1">
										<strong class="text-[var(--app-text-md)] font-semibold">{groupKey}</strong>
										<small class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
											{primary?.slot ?? t('courseCard.noTime')} · {formatVariantCount(courses.length)}
										</small>
									</div>
									<span aria-hidden="true" class="text-[var(--app-color-fg-muted)]">
										{expanded ? '▴' : '▾'}
									</span>
								</button>
								{#if expanded}
									<div class="flex flex-col gap-3 border-t border-[color:var(--app-color-border-subtle)] px-3 pb-4">
										{#each courses as course, variantIndex (course.id)}
											{@const conflict = describeConflict(course.id)}
											{@const variantTotal = variantsCount(course.id)}
											{@const isSameTime = course.slot === primary.slot}
											{@const isSameLocation = course.location === primary.location}
											<CourseCard
												id={course.id}
												title={course.title}
												teacher={course.teacher}
												teacherId={course.teacherId}
												time={isSameTime ? '—' : course.slot ?? t('courseCard.noTime')}
												specialInfo={isSameLocation ? undefined : course.location}
												campus={course.campus}
												status={course.status}
												crossCampusEnabled={$crossCampusAllowed}
												capacity={course.capacity}
												vacancy={course.vacancy}
												colorSeed={course.id}
												specialTags={course.specialTags}
												onHover={() => handleHover(course)}
												onLeave={handleLeave}
												toneIndex={groupIndex + variantIndex}
												showConflictBadge={Boolean(conflict)}
												conflictDetails={conflict ? [{ label: conflict }] : null}
											>
												<div slot="actions" class={variantActionsClass}>
													{#if variantTotal > 1}
														<button type="button" class={variantButtonClass} on:click={() => reselectCourse(course.id)}>
															{t('panels.selected.reselect')}
														</button>
													{:else}
														<button type="button" class={variantDangerButtonClass} on:click={() => deselectCourse(course.id)}>
															{t('panels.selected.drop')}
														</button>
													{/if}
													{#if conflict}
														<span class="text-[var(--app-text-xs)] text-[var(--app-color-danger)]" title={conflict}>{conflict}</span>
													{/if}
												</div>
											</CourseCard>
										{/each}
									</div>
								{/if}
							</article>
						{/each}
					</div>
				{/if}
			{:else}
				{#if visibleCourses.length === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.selected.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleCourses as course, index (course.id)}
							{@const conflict = describeConflict(course.id)}
							{@const variantTotal = variantsCount(course.id)}
							<CourseCard
								id={course.id}
								title={course.title}
								teacher={course.teacher}
								teacherId={course.teacherId}
								time={course.slot ?? t('courseCard.noTimeShort')}
								specialInfo={course.location}
								campus={course.campus}
								status={course.status}
								crossCampusEnabled={$crossCampusAllowed}
								capacity={course.capacity}
								vacancy={course.vacancy}
								colorSeed={course.id}
								specialTags={course.specialTags}
								onHover={() => handleHover(course)}
								onLeave={handleLeave}
								toneIndex={index}
								showConflictBadge={Boolean(conflict)}
								conflictDetails={conflict ? [{ label: conflict }] : null}
							>
								<div slot="actions" class={variantActionsClass}>
									{#if variantTotal > 1}
										<button type="button" class={variantButtonClass} on:click={() => reselectCourse(course.id)}>
											{t('panels.selected.reselect')}
										</button>
									{:else}
										<button type="button" class={variantDangerButtonClass} on:click={() => deselectCourse(course.id)}>
											{t('panels.selected.drop')}
										</button>
									{/if}
									{#if conflict}
										<span class="text-[var(--app-text-xs)] text-[var(--app-color-danger)]" title={conflict}>{conflict}</span>
									{/if}
								</div>
							</CourseCard>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<svelte:fragment slot="footer">
			{#if showPaginationFooter}
				<PaginationFooter
					currentPage={currentPage}
					totalPages={totalPages}
					pageNeighbors={$pageNeighbors}
					onPageChange={handlePageChange}
				/>
			{/if}
		</svelte:fragment>
	</ListSurface>
</DockPanelShell>
