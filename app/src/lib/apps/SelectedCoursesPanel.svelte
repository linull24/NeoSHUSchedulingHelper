<svelte:options runes={false} />

<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
import CardActionBar from '$lib/components/CardActionBar.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppPagination from '$lib/primitives/AppPagination.svelte';
	import { translator } from '$lib/i18n';
	import { formatConflictLabel } from '$lib/utils/diagnosticLabels';
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

	const actionBarClass = 'flex flex-wrap items-center gap-2 justify-end';
	const variantActionsClass = 'mt-2 flex flex-wrap items-center gap-2 text-[var(--app-text-sm)]';
	const contentContainerClass =
		'flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]';

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
				.map((d) => {
					const label = formatConflictLabel(d.label, t);
					return d.reason ? `${label}${divider}${d.reason}` : label;
				})
				.join(t('panels.common.conflictListSeparator'));
		}
		const targets = meta.conflictTargets
			.map((id) => courseCatalogMap.get(id)?.title ?? null)
			.filter((value): value is string => Boolean(value))
			.join(t('panels.common.conflictNameSeparator'));
		const prefix = formatConflictLabel(meta.conflict, t);
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
		bodyScrollable={true}
		on:scroll={handleScroll}
	>
		<svelte:fragment slot="filters">
			<CourseFiltersToolbar {filters} options={filterOptions} mode="selected" />
		</svelte:fragment>

		<div class={contentContainerClass}>
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
							{@const conflict = describeConflict(primary.id)}
							{@const conflictDetails = conflict ? [{ label: conflict }] : null}
							<div class="flex flex-col gap-3 px-3 py-3">
								<CourseCard
									id={primary.id}
									title={groupKey}
									time={primary.slot ?? t('courseCard.noTime')}
									courseCode={primary.courseCode}
									credit={primary.credit ?? null}
									colorSeed={primary.id}
									showTime={false}
									hoverable={courses.length === 1}
									onHover={courses.length === 1 ? () => handleHover(primary) : undefined}
									onLeave={courses.length === 1 ? handleLeave : undefined}
									toneIndex={groupIndex}
									showConflictBadge={Boolean(conflictDetails)}
									conflictDetails={conflictDetails}
								>
									<CardActionBar slot="actions" class={actionBarClass}>
										<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
											{formatVariantCount(courses.length)}
										</span>
										<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
											{expanded ? t('panels.candidates.toggleMore.collapse') : t('panels.candidates.toggleMore.expand')}
										</AppButton>
									</CardActionBar>
								</CourseCard>
								{#if expanded}
									<div class="flex flex-col gap-3 border-t border-[color:var(--app-color-border-subtle)] pt-3">
										{#each courses as course, variantIndex (course.id)}
											{@const conflict = describeConflict(course.id)}
											{@const variantTotal = variantsCount(course.id)}
											<CourseCard
												id={course.id}
												title={course.title}
												time={course.slot ?? t('courseCard.noTime')}
												courseCode={course.courseCode}
												credit={course.credit ?? null}
												status={course.status}
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
												<CardActionBar slot="actions" class={variantActionsClass}>
													{#if variantTotal > 1}
														<AppButton variant="secondary" size="sm" on:click={() => reselectCourse(course.id)}>
															{t('panels.selected.reselect')}
														</AppButton>
													{:else}
														<AppButton variant="secondary" size="sm" on:click={() => deselectCourse(course.id)}>
															{t('panels.selected.drop')}
														</AppButton>
													{/if}
												</CardActionBar>
											</CourseCard>
										{/each}
									</div>
								{/if}
							</div>
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
								time={course.slot ?? t('courseCard.noTimeShort')}
								courseCode={course.courseCode}
								credit={course.credit ?? null}
								status={course.status}
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
						<CardActionBar slot="actions" class={variantActionsClass}>
							{#if variantTotal > 1}
								<AppButton variant="secondary" size="sm" on:click={() => reselectCourse(course.id)}>
									{t('panels.selected.reselect')}
								</AppButton>
							{:else}
								<AppButton variant="secondary" size="sm" on:click={() => deselectCourse(course.id)}>
									{t('panels.selected.drop')}
								</AppButton>
							{/if}
						</CardActionBar>
					</CourseCard>
				{/each}
			</div>
		{/if}
	{/if}
			{#if showPaginationFooter}
				<div class="mt-auto border-t border-[color:var(--app-color-border-subtle)] px-3 py-1">
					<AppPagination
						currentPage={currentPage}
						totalPages={totalPages}
						pageNeighbors={$pageNeighbors}
						onPageChange={handlePageChange}
					/>
				</div>
			{/if}
		</div>
	</ListSurface>
</DockPanelShell>
