<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import SelectionModePrompt from '$lib/components/SelectionModePrompt.svelte';
		import AppPagination from '$lib/primitives/AppPagination.svelte';
		import { selectionModeNeedsPrompt } from '$lib/stores/coursePreferences';
		import { filterOptions } from '$lib/stores/courseFilters';
		import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
		import { translator } from '$lib/i18n';
		import { getAvailabilityHint } from '$lib/utils/availabilityHints';
		import {
			activeId,
			addCourse,
			addGroupToWishlist,
			canAddToWishlist,
			collapseByName,
			computeStateLabel,
			getAvailability,
			expandedGroups,
			filteredCourses,
			filterMeta,
			filters,
			groupedEntries,
		handleHover,
		handleLeave,
		reselectCourseFromList,
		removeGroupFromWishlist,
		selectedSet,
		toggleGroup,
		wishlistSet
	} from './AllCoursesPanel.state';
	import type { WishlistActionState } from './AllCoursesPanel.state';

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

let currentPage = 1;
let loadedCount = 0;
let lastMode: 'paged' | 'continuous' | null = null;
let contentSignature = '';
let showPaginationFooter = false;

const actionBarClass = 'flex flex-wrap items-center gap-2 justify-end';

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
	bodyScrollable={true}
	on:scroll={handleScroll}
>
	<svelte:fragment slot="filters">
		<CourseFiltersToolbar {filters} options={filterOptions} mode="all" />
	</svelte:fragment>

	<div class="flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]">
			{#if $collapseByName}
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleGroups as [groupKey, courses], groupIndex (groupKey)}
							{@const primary = courses[0]}
							{@const expanded = $expandedGroups.has(groupKey)}
							{@const meta = $filterMeta.get(primary.id)}
							{@const conflictItems =
								meta?.diagnostics?.length
									? meta.diagnostics.map((d) => ({ label: d.label ?? 'conflict' }))
									: meta?.conflict && meta.conflict !== 'none'
										? [{ label: meta.conflict }]
										: null}
							{@const canAddAny =
								courses.some(
									(course) =>
										!$wishlistSet.has(course.id) && !$selectedSet.has(course.id) && canAddToWishlist(course.id)
								)}
							{@const groupDisabled = !$wishlistSet.has(primary.id) && !canAddAny}
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
									showConflictBadge={Boolean(conflictItems)}
									conflictDetails={conflictItems}
								>
										<CardActionBar slot="actions" class={actionBarClass}>
											<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
												{formatVariantCount(courses.length)}
											</span>
											<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
											{expanded ? t('panels.candidates.toggleMore.collapse') : t('panels.candidates.toggleMore.expand')}
										</AppButton>
										<AppButton
											variant="secondary"
											size="sm"
												on:click={() =>
													($wishlistSet.has(primary.id)
														? removeGroupFromWishlist(courses, $wishlistSet)
														: addGroupToWishlist(courses, $wishlistSet))}
												disabled={groupDisabled}
											>
												{$wishlistSet.has(primary.id)
													? t('panels.allCourses.removeGroup')
													: t('panels.allCourses.addGroup')}
											</AppButton>
											{#if groupDisabled}
												<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{t('panels.common.availability.groupNoSelectable')}
												</span>
											{/if}
										</CardActionBar>
									</CourseCard>
									{#if expanded}
										<div class="flex flex-col gap-3 border-t border-[color:var(--app-color-border-subtle)] pt-3">
											{#each courses as course, variantIndex (course.id)}
												{@const inWishlist = $wishlistSet.has(course.id)}
												{@const inSelected = $selectedSet.has(course.id)}
												{@const actionState = computeStateLabel(inWishlist, inSelected)}
												{@const canAdd = actionState === 'add' ? canAddToWishlist(course.id) : true}
												{@const availability = actionState === 'add' ? getAvailability(course.id) : null}
												{@const availabilityHint =
													availability && availability.availability !== 'OK_NO_RESCHEDULE'
														? getAvailabilityHint(availability, t)
														: null}
												{@const meta = $filterMeta.get(course.id)}
												{@const conflictItems =
													meta?.diagnostics?.length
														? meta.diagnostics.map((d) => ({ label: d.label ?? 'conflict' }))
														: meta?.conflict && meta.conflict !== 'none'
															? [{ label: meta.conflict }]
															: null}
											<CourseCard
												id={course.id}
												title={course.title}
												time={course.slot ?? t('courseCard.noTime')}
												courseCode={course.courseCode}
												credit={course.credit ?? null}
												capacity={course.capacity}
												vacancy={course.vacancy}
												colorSeed={course.id}
												specialTags={course.specialTags}
												onHover={() => handleHover(course)}
												onLeave={handleLeave}
												toneIndex={groupIndex + variantIndex}
												showConflictBadge={Boolean(conflictItems)}
												conflictDetails={conflictItems}
											>
	                                                <CardActionBar slot="actions" class={actionBarClass}>
	                                                    <AppButton
	                                                        variant="secondary"
	                                                        size="sm"
	                                                        class="rounded-[var(--app-radius-pill)]"
                                                        on:click={() =>
                                                            inSelected
                                                                ? reselectCourseFromList(course.id)
                                                                : inWishlist
                                                                    ? removeGroupFromWishlist([course], $wishlistSet)
                                                                    : addCourse(course.id, inWishlist, inSelected)}
	                                                        disabled={!canAdd}
	                                                    >
	                                                        {#if inSelected}
	                                                            {t('panels.selected.reselect')}
	                                                        {:else if inWishlist}
	                                                            {t('panels.allCourses.removeGroup')}
	                                                        {:else}
	                                                            {resolveStateLabel(actionState)}
	                                                        {/if}
	                                                    </AppButton>
														{#if availabilityHint}
															<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
																{availabilityHint}
															</span>
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
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleCourses as course, index (course.id)}
								{@const inWishlist = $wishlistSet.has(course.id)}
								{@const inSelected = $selectedSet.has(course.id)}
								{@const actionState = computeStateLabel(inWishlist, inSelected)}
								{@const canAdd = actionState === 'add' ? canAddToWishlist(course.id) : true}
								{@const availability = actionState === 'add' ? getAvailability(course.id) : null}
								{@const availabilityHint =
									availability && availability.availability !== 'OK_NO_RESCHEDULE'
										? getAvailabilityHint(availability, t)
										: null}
								{@const meta = $filterMeta.get(course.id)}
								{@const conflictItems =
									meta?.diagnostics?.length
										? meta.diagnostics.map((d) => ({ label: d.label ?? 'conflict' }))
										: meta?.conflict && meta.conflict !== 'none'
											? [{ label: meta.conflict }]
											: null}
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
								toneIndex={index}
								showConflictBadge={Boolean(conflictItems)}
								conflictDetails={conflictItems}
							>
									<CardActionBar slot="actions" class="justify-start">
										<AppButton
											variant={inSelected || inWishlist ? 'secondary' : 'primary'}
											size="sm"
											class="rounded-[var(--app-radius-pill)]"
										on:click={() =>
											inSelected
												? reselectCourseFromList(course.id)
												: inWishlist
													? removeGroupFromWishlist([course], $wishlistSet)
													: addCourse(course.id, inWishlist, inSelected)}
											disabled={!canAdd}
										>
											{#if inSelected}
												{t('panels.selected.reselect')}
											{:else if inWishlist}
												{t('panels.allCourses.removeGroup')}
											{:else}
												{resolveStateLabel(actionState)}
											{/if}
										</AppButton>
										{#if availabilityHint}
											<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{availabilityHint}
											</span>
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

<SelectionModePrompt open={showModePrompt} onClose={handleModePromptClose} />
