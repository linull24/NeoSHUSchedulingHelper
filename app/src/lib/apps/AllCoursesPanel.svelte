<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import SelectionModePrompt from '$lib/components/SelectionModePrompt.svelte';
	import PaginationFooter from '$lib/components/PaginationFooter.svelte';
	import { crossCampusAllowed, selectionModeNeedsPrompt } from '$lib/stores/coursePreferences';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { translator } from '$lib/i18n';
	import {
		collapseByName,
		filteredCourses,
		groupedEntries,
		wishlistSet,
		selectedSet,
		activeId,
		expandedGroups,
		filters,
		filterMeta,
		handleHover,
		handleLeave,
		toggleGroup,
		addCourse,
		computeStateLabel,
		addGroupToWishlist,
		removeGroupFromWishlist,
		reselectCourseFromList,
		toggleIntentSelection,
		setIntentSelection
	} from './AllCoursesPanel.state';
	import type { WishlistActionState } from './AllCoursesPanel.state';
	import { intentSelection } from '$lib/stores/intentSelection';

let showModePrompt = false;
let promptDismissed = false;

$: if (!$selectionModeNeedsPrompt) {
	promptDismissed = false;
}
$: showModePrompt = $selectionModeNeedsPrompt && !promptDismissed;

let t = (key: string) => key;
$: t = $translator;

const formatVariantCount = (count: number) =>
	t('panels.allCourses.variantCountLabel').replace('{count}', String(count));

const resolveStateLabel = (state: WishlistActionState) =>
	t(`panels.allCourses.stateLabels.${state}`);
$: includeShort = t('courseCard.includeShort');
$: excludeShort = t('courseCard.excludeShort');

let currentPage = 1;
let loadedCount = 0;
let lastMode: 'paged' | 'continuous' | null = null;
let contentSignature = '';
let showPaginationFooter = false;

const actionButtonClass =
	'inline-flex items-center rounded-[var(--app-radius-pill)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-3 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_90%,#000)] disabled:opacity-60 disabled:pointer-events-none';
const intentButtonClass =
	'inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1 text-[var(--app-text-xs)] text-[var(--app-color-fg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]';

$: pageSizeValue = Math.max(1, $pageSize || 1);
$: courseCount = $filteredCourses.length;
$: groupCount = $groupedEntries.length;
$: totalItems = $collapseByName ? groupCount : courseCount;
$: totalPages = Math.max(1, Math.ceil(Math.max(1, totalItems) / pageSizeValue));
$: showPaginationFooter = $paginationMode === 'paged' && totalPages > 1;

$: {
	const sig = `${$collapseByName ? 'group' : 'course'}:${totalItems}`;
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

$: visibleCourses = $collapseByName ? [] : sliceCollection($filteredCourses);
$: visibleGroups = $collapseByName ? sliceCollection($groupedEntries) : [];

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

 function handleModePromptClose() {
	promptDismissed = true;
 }

function sliceCollection<T>(collection: T[]): T[] {
	if ($paginationMode === 'paged') {
		const start = (currentPage - 1) * pageSizeValue;
		const end = start + pageSizeValue;
		return collection.slice(start, end);
	}
	const limit = Math.min(collection.length, loadedCount);
	return collection.slice(0, limit);
}

</script>

<DockPanelShell class="flex-1 min-h-0">
<ListSurface
	title={t('panels.allCourses.title')}
	subtitle={t('panels.allCourses.description')}
	count={courseCount}
	density="comfortable"
	enableStickyToggle={true}
	bodyScrollable={false}
>
	<svelte:fragment slot="filters">
		<CourseFiltersToolbar {filters} options={filterOptions} mode="all" />
	</svelte:fragment>

	<div
		class="h-full min-h-[240px] overflow-auto rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]"
		on:scroll={handleScroll}
	>
			{#if $collapseByName}
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleGroups as [groupKey, courses], groupIndex (groupKey)}
							{@const primary = courses[0]}
							{@const primaryTime = primary?.slot ?? t('courseCard.noTime')}
							{@const primaryLocation = primary?.location ?? ''}
							{@const expanded = $expandedGroups.has(groupKey)}
							<article class={`flex flex-col ${expanded ? 'bg-[var(--app-color-bg-muted)]' : 'bg-transparent'}`}>
								<button
									type="button"
									class="flex w-full items-center justify-between px-4 py-3 text-left text-[var(--app-color-fg)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]"
									on:click={() => toggleGroup(groupKey)}
								>
									<div class="flex flex-col gap-1">
										<span class="text-[var(--app-text-md)] font-semibold">{groupKey}</span>
										<small class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
											{primaryTime} · {formatVariantCount(courses.length)}
										</small>
									</div>
									<span aria-hidden="true" class="text-[var(--app-color-fg-muted)]">
										{expanded ? '▴' : '▾'}
									</span>
								</button>
								<div class="flex flex-wrap items-center justify-between px-4 pb-2 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
									<span>{primaryLocation}</span>
									<button
										type="button"
										class="text-[var(--app-text-sm)] text-[var(--app-color-primary)] transition-colors hover:text-[color-mix(in_srgb,var(--app-color-primary)_80%,black)]"
										on:click={() =>
											($wishlistSet.has(primary.id)
												? removeGroupFromWishlist(courses, $wishlistSet)
												: addGroupToWishlist(courses, $wishlistSet))}
									>
										{$wishlistSet.has(primary.id)
											? t('panels.allCourses.removeGroup')
											: t('panels.allCourses.addGroup')}
									</button>
								</div>
								{#if expanded}
									<div class="flex flex-col gap-3 border-t border-[color:var(--app-color-border-subtle)] px-3 pb-4">
										{#each courses as course, variantIndex (course.id)}
											{@const inWishlist = $wishlistSet.has(course.id)}
											{@const inSelected = $selectedSet.has(course.id)}
											{@const actionState = computeStateLabel(inWishlist, inSelected)}
											{@const isSameTime = course.slot === primary.slot}
											{@const isSameLocation = course.location === primaryLocation}
											{@const meta = $filterMeta.get(course.id)}
											{@const conflictItems =
												meta?.diagnostics?.length
													? meta.diagnostics.map((d) => ({ label: d.label ?? 'conflict' }))
													: meta?.conflict
														? [{ label: meta.conflict }]
														: null}
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
												selectable={true}
												selectState={$intentSelection.get(course.id) ?? null}
												onToggleSelect={() => toggleIntentSelection(course.id)}
												showConflictBadge={Boolean(meta?.conflict)}
												conflictDetails={conflictItems}
											>
												<div slot="actions" class="flex flex-wrap items-center gap-2">
													<button
														type="button"
														class={actionButtonClass}
														on:click={() =>
															inSelected
																? reselectCourseFromList(course.id)
																: inWishlist
																	? removeGroupFromWishlist([course], $wishlistSet)
																	: addCourse(course.id, inWishlist, inSelected)}
														disabled={inWishlist && !inSelected}
													>
														{#if inSelected}
															{t('panels.selected.reselect')}
														{:else if inWishlist}
															{t('panels.allCourses.removeGroup')}
														{:else}
															{resolveStateLabel(actionState)}
														{/if}
													</button>
													<div class="flex items-center gap-1">
														<button type="button" class={intentButtonClass} on:click={() => setIntentSelection(course.id, 'include')}>
															{includeShort}
														</button>
														<button type="button" class={intentButtonClass} on:click={() => setIntentSelection(course.id, 'exclude')}>
															{excludeShort}
														</button>
													</div>
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
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleCourses as course, index (course.id)}
							{@const inWishlist = $wishlistSet.has(course.id)}
							{@const inSelected = $selectedSet.has(course.id)}
							{@const meta = $filterMeta.get(course.id)}
							{@const conflictItems =
								meta?.diagnostics?.length
									? meta.diagnostics.map((d) => ({ label: d.label ?? 'conflict' }))
									: meta?.conflict
										? [{ label: meta.conflict }]
										: null}
							<CourseCard
								id={course.id}
								title={course.title}
								teacher={course.teacher}
								teacherId={course.teacherId}
								time={course.slot ?? t('courseCard.noTime')}
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
								selectable={true}
								selectState={$intentSelection.get(course.id) ?? null}
								onToggleSelect={() => toggleIntentSelection(course.id)}
								showConflictBadge={Boolean(meta?.conflict)}
								conflictDetails={conflictItems}
							>
								<div slot="actions" class="flex flex-wrap items-center gap-2">
									<button
										type="button"
										class={actionButtonClass}
										on:click={() =>
											inSelected
												? reselectCourseFromList(course.id)
												: inWishlist
													? removeGroupFromWishlist([course], $wishlistSet)
													: addCourse(course.id, inWishlist, inSelected)}
										disabled={inWishlist && !inSelected}
									>
										{#if inSelected}
											{t('panels.selected.reselect')}
										{:else if inWishlist}
											{t('panels.allCourses.removeGroup')}
										{:else}
											{resolveStateLabel(computeStateLabel(inWishlist, inSelected))}
										{/if}
									</button>
									<div class="flex items-center gap-1">
										<button type="button" class={intentButtonClass} on:click={() => setIntentSelection(course.id, 'include')}>
											{includeShort}
										</button>
										<button type="button" class={intentButtonClass} on:click={() => setIntentSelection(course.id, 'exclude')}>
											{excludeShort}
										</button>
									</div>
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

<SelectionModePrompt open={showModePrompt} onClose={handleModePromptClose} />
