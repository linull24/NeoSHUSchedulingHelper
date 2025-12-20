<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import ContinuousPager from '$lib/components/ContinuousPager.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import CardBulkCheckbox from '$lib/components/CardBulkCheckbox.svelte';
	import CourseBulkControls from '$lib/components/CourseBulkControls.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppPagination from '$lib/primitives/AppPagination.svelte';
	import { dispatchTermAction, dispatchTermActionWithEffects, termState } from '$lib/stores/termStateStore';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { translator } from '$lib/i18n';
	import { getAvailabilityHint } from '$lib/utils/availabilityHints';
	import { bulkClear, bulkHas, bulkSetAll, bulkToggle, type CourseBulkItem } from '$lib/utils/courseBulk';
	import { deriveGroupKey } from '$lib/data/termState/groupKey';
	import {
		activeId,
		addGroupToWishlist,
		addCourse,
		canAddToWishlist,
		collapseByName,
		getAvailability,
		expandedGroups,
		filteredCourses,
		filterMeta,
		filters,
		groupedEntries,
		wishlistedSectionGroupKeySet,
		handleHover,
		handleLeave,
		removeGroupFromWishlist,
		selectedGroupKeySet,
		selectedSet,
		toggleGroup,
		wishlistGroupKeySet,
		wishlistSet
	} from './AllCoursesPanel.state';
	import type { WishlistActionState } from './AllCoursesPanel.state';

let t = (key: string) => key;
$: t = $translator;
	$: autoSolveEnabled = $termState?.settings.autoSolveEnabled ?? false;

const formatVariantCount = (count: number) =>
	t('panels.allCourses.variantCountLabel').replace('{count}', String(count));

	const resolveStateLabel = (state: WishlistActionState) =>
		t(`panels.allCourses.stateLabels.${state}`);

	type BulkItem = CourseBulkItem<'group' | 'section'>;
	type BulkAction = 'wishlistAdd' | 'wishlistRemove';

	let bulkSelection = new Map<string, BulkItem>();
	let bulkAction: BulkAction = 'wishlistAdd';
	let bulkBusy = false;
	let bulkMessage = '';

	async function dropSelected(entryId: string) {
		await dispatchTermAction({ type: 'SEL_DROP_SELECTED_SECTION', entryId: entryId as any });
	}

	async function reselectWithinGroup(groupKey: string, entryId: string) {
		await dispatchTermAction({ type: 'SEL_RESELECT_WITHIN_GROUP', groupKey: groupKey as any, nextEntryId: entryId as any });
	}

	let scrollRoot: HTMLElement | null = null;
	let continuousActivePage = 1;

let currentPage = 1;
let contentSignature = '';
let showPaginationFooter = false;

const actionBarClass = 'flex flex-wrap items-center gap-2 justify-end';
const groupDenseActionBarClass =
	'flex flex-wrap items-center gap-x-[var(--app-space-1)] gap-y-0 justify-end';

$: pageSizeValue = Math.max(1, $pageSize || 1);
$: courseCount = $filteredCourses.length;
$: groupCount = $groupedEntries.length;
$: totalItems = $collapseByName ? groupCount : courseCount;
$: totalPages = Math.max(1, Math.ceil(Math.max(1, totalItems) / pageSizeValue));
$: showPaginationFooter = $paginationMode === 'paged' && totalPages > 1;
$: bulkCount = bulkSelection.size;
$: bulkSelectAllLabel =
	$paginationMode === 'paged' && totalPages > 1
		? t('panels.allCourses.bulk.selectPage')
		: t('panels.allCourses.bulk.selectAll');

$: {
	const sig = `${$collapseByName ? 'group' : 'course'}:${totalItems}`;
	if (sig !== contentSignature) {
		contentSignature = sig;
		currentPage = 1;
		continuousActivePage = 1;
	}
}

$: windowPageMin =
	$paginationMode === 'paged' ? currentPage : Math.max(1, continuousActivePage - ($pageNeighbors ?? 0));
$: windowPageMax =
	$paginationMode === 'paged' ? currentPage : Math.min(totalPages, continuousActivePage + ($pageNeighbors ?? 0));
$: windowStartIndex = (windowPageMin - 1) * pageSizeValue;
$: windowEndIndex = Math.min(totalItems, windowPageMax * pageSizeValue);

$: visibleCourses =
	$collapseByName
		? []
		: $filteredCourses.slice(
				windowStartIndex,
				$paginationMode === 'paged' ? windowStartIndex + pageSizeValue : windowEndIndex
			);

$: visibleGroups =
	$collapseByName
		? $groupedEntries.slice(
				windowStartIndex,
				$paginationMode === 'paged' ? windowStartIndex + pageSizeValue : windowEndIndex
			)
		: [];

	function clearBulkSelection() {
		bulkSelection = bulkClear();
		bulkBusy = false;
		bulkMessage = '';
	}

	function selectAllVisible() {
		const items: BulkItem[] = [];
		if ($collapseByName) {
			for (const [groupKey, courses] of visibleGroups) {
				items.push({ kind: 'group', key: groupKey });
				if ($expandedGroups.has(groupKey)) {
					for (const course of courses) {
						items.push({ kind: 'section', key: course.id });
					}
				}
			}
		} else {
			for (const course of visibleCourses) {
				items.push({ kind: 'section', key: course.id });
			}
		}
		bulkSelection = bulkSetAll(items);
		bulkMessage = '';
	}

	function triggerAutoSolveRunNow() {
		const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'AUTO_SOLVE_RUN', mode: 'merge' });
		void result.then((dispatched) => {
			if (!dispatched.ok) {
				bulkMessage = dispatched.error.message;
				return;
			}
			void effectsDone;
		});
	}

	async function toggleGroupTarget(groupKey: string, primaryId: string) {
		if (!autoSolveEnabled) return;
		const isTargetGroup = $wishlistGroupKeySet.has(groupKey as any);
		if (isTargetGroup) {
			await dispatchTermAction({ type: 'SEL_DEMOTE_GROUP', groupKey: groupKey as any, to: 'all' });
			return;
		}

		const meta = $filterMeta.get(primaryId);
		const blocked = Boolean(meta?.currentImpossible);
		if (blocked) return;

		const result = await dispatchTermAction({ type: 'SEL_PROMOTE_GROUP', groupKey: groupKey as any, to: 'wishlist' });
		if (result.ok) triggerAutoSolveRunNow();
	}

	async function executeBulk() {
		if (!bulkSelection.size || bulkBusy) return;
		bulkBusy = true;
		bulkMessage = '';

		const items = Array.from(bulkSelection.values());
		let applied = 0;
		let skipped = 0;
		const sectionAdds: string[] = [];
		const sectionRemoves: string[] = [];
		try {
			const groupedMap = $collapseByName ? new Map($groupedEntries) : null;
			for (const item of items) {
				if (bulkAction === 'wishlistAdd') {
					if (item.kind === 'group') {
						const groupKey = item.key as any;
						const courses = groupedMap?.get(groupKey as any) ?? [];
						const canAddAny =
							courses.length > 0 &&
							courses.some(
								(course: any) =>
									!$wishlistSet.has(course.id) && !$selectedSet.has(course.id) && canAddToWishlist(course.id)
							);
						if (!canAddAny) {
							skipped += 1;
							continue;
						}
						addGroupToWishlist(courses, $wishlistSet);
						applied += 1;
						continue;
					}

					const entryId = item.key;
					if ($selectedSet.has(entryId) || $wishlistSet.has(entryId) || !canAddToWishlist(entryId)) {
						skipped += 1;
						continue;
					}
					sectionAdds.push(entryId);
					continue;
				}

				// wishlistRemove
				if (item.kind === 'group') {
					const groupKey = item.key as any;
					const courses = groupedMap?.get(groupKey as any) ?? [];
					const hasAnyWishlist = courses.some((course: any) => $wishlistSet.has(course.id));
					if (!hasAnyWishlist) {
						skipped += 1;
						continue;
					}
					removeGroupFromWishlist(courses, $wishlistSet);
					applied += 1;
					continue;
				}

				const entryId = item.key;
				if (!$wishlistSet.has(entryId)) {
					skipped += 1;
					continue;
				}
				sectionRemoves.push(entryId);
			}
			if (sectionAdds.length) {
				const result = await dispatchTermAction({
					type: 'SEL_PROMOTE_SECTION_MANY',
					entryIds: sectionAdds as any,
					to: 'wishlist'
				});
				if (result.ok) applied += sectionAdds.length;
				else skipped += sectionAdds.length;
			}
			if (sectionRemoves.length) {
				const result = await dispatchTermAction({ type: 'SEL_UNWISHLIST_SECTION_MANY', entryIds: sectionRemoves as any });
				if (result.ok) applied += sectionRemoves.length;
				else skipped += sectionRemoves.length;
			}
		} finally {
			bulkBusy = false;
		}

		clearBulkSelection();
		if (applied > 0) {
			bulkMessage = t('panels.allCourses.bulk.done').replace('{applied}', String(applied)).replace('{skipped}', String(skipped));
		} else if (skipped > 0) {
			bulkMessage = t('panels.allCourses.bulk.nothing').replace('{skipped}', String(skipped));
		}
	}

 function handlePageChange(page: number) {
	currentPage = Math.max(1, Math.min(totalPages, page));
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
	bind:scrollRoot
>
	<svelte:fragment slot="header-actions">
		<CourseBulkControls
			busy={bulkBusy}
			selectAllLabel={bulkSelectAllLabel}
			clearSelectionLabel={t('panels.allCourses.bulk.clearSelection')}
			countLabel={t('panels.allCourses.bulk.label').replace('{count}', String(bulkCount))}
			actionOptions={[
				{ value: 'wishlistAdd', label: t('panels.allCourses.bulk.actions.wishlistAdd') },
				{ value: 'wishlistRemove', label: t('panels.allCourses.bulk.actions.wishlistRemove') }
			]}
			bind:action={bulkAction}
			executeLabel={t('panels.allCourses.bulk.execute')}
			workingLabel={t('panels.allCourses.bulk.working')}
			disableSelectAll={totalItems === 0}
			disableClear={bulkCount === 0}
			disableExecute={bulkCount === 0}
			onSelectAll={selectAllVisible}
			onClearSelection={clearBulkSelection}
			onExecute={executeBulk}
		/>
	</svelte:fragment>
	<svelte:fragment slot="filters">
		<CourseFiltersToolbar {filters} options={filterOptions} mode="all" statusModeScope="none" />
	</svelte:fragment>

	<div class="flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]">
			{#if $collapseByName}
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					{#if $paginationMode === 'paged'}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleGroups as [groupKey, courses], groupIndex (groupKey)}
							{@const primary = courses[0]}
							{@const expanded = $expandedGroups.has(groupKey)}
								{@const meta = $filterMeta.get(primary.id)}
								{@const conflictItems =
									meta?.hardImpossible && meta?.diagnostics?.length
										? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
										: null}
							{@const showConflictBadges = $filters.showConflictBadges}
							{@const canAddAny =
									courses.some(
											(course: any) =>
												!$wishlistSet.has(course.id) && !$selectedSet.has(course.id) && canAddToWishlist(course.id)
										)}
							{@const groupInWishlist = $wishlistedSectionGroupKeySet.has(groupKey as any)}
							{@const groupInTarget = $wishlistGroupKeySet.has(groupKey as any)}
							{@const groupDisabled = !groupInWishlist && !canAddAny}
							{@const autoTargetBlocked = Boolean(meta?.currentImpossible)}
							<div class="flex flex-col gap-2 px-3 py-2">
									<CourseCard
										id={primary.id}
										density="dense"
										title={primary.title ?? String(groupKey)}
										teacher={courses.length === 1 ? primary.teacher : null}
										time={primary.slot ?? t('courseCard.noTime')}
										courseCode={primary.courseCode}
										credit={primary.credit ?? null}
										colorSeed={primary.id}
									showTime={false}
									hoverable={courses.length === 1}
									onHover={courses.length === 1 ? () => handleHover(primary) : undefined}
									onLeave={courses.length === 1 ? handleLeave : undefined}
									toneIndex={groupIndex}
									showConflictBadge={showConflictBadges && Boolean(conflictItems)}
									conflictDetails={showConflictBadges ? conflictItems : null}
								>
									<svelte:fragment slot="meta-controls">
										<CardBulkCheckbox
											checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
											ariaLabel={t('panels.allCourses.bulk.selectGroup').replace(
												'{name}',
												primary.title ?? String(groupKey)
											)}
											on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
										/>
									</svelte:fragment>
										<CardActionBar slot="actions" class={groupDenseActionBarClass}>
											<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
												{formatVariantCount(courses.length)}
											</span>
											<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
											{expanded ? t('panels.candidates.toggleMore.collapse') : t('panels.candidates.toggleMore.expand')}
										</AppButton>
											{#if autoSolveEnabled}
												<AppButton
													variant={groupInTarget ? 'secondary' : 'primary'}
													size="sm"
													disabled={!groupInTarget && autoTargetBlocked}
													title={!groupInTarget && autoTargetBlocked ? t('panels.candidates.autoTargetBlocked') : undefined}
													on:click={() => toggleGroupTarget(groupKey as any, primary.id)}
												>
													{groupInTarget ? t('panels.candidates.autoTargetRemove') : t('panels.candidates.autoTargetAdd')}
												</AppButton>
											{:else}
												<AppButton
													variant="secondary"
													size="sm"
													on:click={() =>
														groupInWishlist
															? removeGroupFromWishlist(courses, $wishlistSet)
															: addGroupToWishlist(courses, $wishlistSet)}
													disabled={groupDisabled}
												>
													{groupInWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
												</AppButton>
												{#if groupDisabled}
													<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
														{t('panels.common.availability.groupNoSelectable')}
													</span>
												{/if}
											{/if}
										</CardActionBar>
									</CourseCard>
									{#if expanded}
										<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
												{#each courses as course, variantIndex (course.id)}
													{@const inWishlist = $wishlistSet.has(course.id)}
													{@const inSelected = $selectedSet.has(course.id)}
													{@const canWishlistAdd = !inWishlist ? canAddToWishlist(course.id) : true}
													{@const availability = getAvailability(course.id)}
													{@const availabilityHint =
														availability.availability !== 'OK_NO_RESCHEDULE'
															? getAvailabilityHint(availability, t)
															: null}
												{@const meta = $filterMeta.get(course.id)}
												{@const conflictItems = meta?.diagnostics?.length
													? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
													: null}
												{@const showConflictBadges = $filters.showConflictBadges}
												<CourseCard
													id={course.id}
													density="dense"
													title={course.title}
													teacher={course.teacher}
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
												showConflictBadge={showConflictBadges && Boolean(conflictItems)}
												conflictDetails={showConflictBadges ? conflictItems : null}
												>
													<svelte:fragment slot="meta-controls">
														<CardBulkCheckbox
															checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
															ariaLabel={t('panels.allCourses.bulk.selectSection').replace('{name}', course.title)}
															on:toggle={() =>
																(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
														/>
													</svelte:fragment>
		                                                <CardActionBar slot="actions" class={actionBarClass}>
															{#if !autoSolveEnabled}
																<AppButton
																	variant={inWishlist ? 'secondary' : 'primary'}
																	size="sm"
																	class="rounded-[var(--app-radius-pill)]"
																	on:click={() =>
																		inWishlist
																			? removeGroupFromWishlist([course], $wishlistSet)
																			: addCourse(course.id, inWishlist, inSelected)}
																	disabled={!canWishlistAdd}
																>
																		{inWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
																	</AppButton>
																{/if}
															{#if !autoSolveEnabled}
																{#if availability.availability === 'SELECTED'}
																	<AppButton
																		variant="secondary"
																		size="sm"
																		class="rounded-[var(--app-radius-pill)]"
																		on:click={() => dropSelected(course.id)}
																	>
																		{t('panels.selected.drop')}
																	</AppButton>
																	{:else if availability.availability === 'OK_WITH_RESELECT' && $selectedGroupKeySet.has(groupKey as any)}
																		<AppButton
																			variant="secondary"
																			size="sm"
																		class="rounded-[var(--app-radius-pill)]"
																		disabled={!availability.allowed}
																		title={availabilityHint ?? undefined}
																		on:click={() => reselectWithinGroup(groupKey, course.id)}
																	>
																		{t('panels.selected.reselect')}
																	</AppButton>
																{/if}
															{/if}
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
					{:else}
						<ContinuousPager
							items={$groupedEntries}
							pageSize={pageSizeValue}
							neighbors={$pageNeighbors}
							{scrollRoot}
							bind:activePage={continuousActivePage}
							let:page
						>
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each page.items as [groupKey, courses], groupIndex (groupKey)}
									{@const absIndex = page.start + groupIndex}
							{@const primary = courses[0]}
							{@const expanded = $expandedGroups.has(groupKey)}
								{@const meta = $filterMeta.get(primary.id)}
								{@const conflictItems =
									meta?.hardImpossible && meta?.diagnostics?.length
												? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
												: null}
							{@const showConflictBadges = $filters.showConflictBadges}
									{@const canAddAny =
									courses.some(
											(course: any) =>
												!$wishlistSet.has(course.id) && !$selectedSet.has(course.id) && canAddToWishlist(course.id)
										)}
							{@const groupInWishlist = $wishlistedSectionGroupKeySet.has(groupKey as any)}
							{@const groupInTarget = $wishlistGroupKeySet.has(groupKey as any)}
							{@const groupDisabled = !groupInWishlist && !canAddAny}
							{@const autoTargetBlocked = Boolean(meta?.currentImpossible)}
									<div class="flex flex-col gap-2 px-3 py-2">
										<CourseCard
											id={primary.id}
											density="dense"
											title={primary.title ?? String(groupKey)}
											teacher={courses.length === 1 ? primary.teacher : null}
											time={primary.slot ?? t('courseCard.noTime')}
											courseCode={primary.courseCode}
											credit={primary.credit ?? null}
											colorSeed={primary.id}
											showTime={false}
											hoverable={courses.length === 1}
											onHover={courses.length === 1 ? () => handleHover(primary) : undefined}
											onLeave={courses.length === 1 ? handleLeave : undefined}
											toneIndex={absIndex}
											showConflictBadge={showConflictBadges && Boolean(conflictItems)}
											conflictDetails={showConflictBadges ? conflictItems : null}
											>
													<svelte:fragment slot="meta-controls">
														<CardBulkCheckbox
															checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
															ariaLabel={t('panels.allCourses.bulk.selectGroup').replace('{name}', primary.title ?? String(groupKey))}
															on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
														/>
													</svelte:fragment>
											<CardActionBar slot="actions" class={groupDenseActionBarClass}>
												<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
													{formatVariantCount(courses.length)}
											</span>
											<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
											{expanded ? t('panels.candidates.toggleMore.collapse') : t('panels.candidates.toggleMore.expand')}
										</AppButton>
													{#if autoSolveEnabled}
														<AppButton
															variant={groupInTarget ? 'secondary' : 'primary'}
															size="sm"
														disabled={!groupInTarget && autoTargetBlocked}
														title={!groupInTarget && autoTargetBlocked ? t('panels.candidates.autoTargetBlocked') : undefined}
														on:click={() => toggleGroupTarget(groupKey as any, primary.id)}
														>
															{groupInTarget ? t('panels.candidates.autoTargetRemove') : t('panels.candidates.autoTargetAdd')}
														</AppButton>
													{:else}
															<AppButton
																variant="secondary"
																size="sm"
														on:click={() =>
															groupInWishlist
																? removeGroupFromWishlist(courses, $wishlistSet)
																: addGroupToWishlist(courses, $wishlistSet)}
														disabled={groupDisabled}
													>
														{groupInWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
													</AppButton>
														{#if groupDisabled}
																<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
																	{t('panels.common.availability.groupNoSelectable')}
																</span>
															{/if}
														{/if}
											</CardActionBar>
										</CourseCard>
										{#if expanded}
											<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
												{#each courses as course, variantIndex (course.id)}
													{@const inWishlist = $wishlistSet.has(course.id)}
													{@const inSelected = $selectedSet.has(course.id)}
													{@const canWishlistAdd = !inWishlist ? canAddToWishlist(course.id) : true}
													{@const availability = getAvailability(course.id)}
													{@const availabilityHint =
														availability.availability !== 'OK_NO_RESCHEDULE'
															? getAvailabilityHint(availability, t)
															: null}
													{@const meta = $filterMeta.get(course.id)}
													{@const conflictItems = meta?.diagnostics?.length
														? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
														: null}
													<CourseCard
														id={course.id}
														density="dense"
														title={course.title}
														teacher={course.teacher}
														time={course.slot ?? t('courseCard.noTime')}
														courseCode={course.courseCode}
														credit={course.credit ?? null}
														capacity={course.capacity}
														vacancy={course.vacancy}
														colorSeed={course.id}
														specialTags={course.specialTags}
														onHover={() => handleHover(course)}
														onLeave={handleLeave}
														toneIndex={absIndex + variantIndex}
														showConflictBadge={Boolean(conflictItems)}
														conflictDetails={conflictItems}
													>
														<svelte:fragment slot="meta-controls">
															<CardBulkCheckbox
																checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
																ariaLabel={t('panels.allCourses.bulk.selectSection').replace('{name}', course.title)}
																on:toggle={() =>
																	(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
															/>
														</svelte:fragment>
														<CardActionBar slot="actions" class={actionBarClass}>
															{#if !autoSolveEnabled}
																<AppButton
																	variant={inWishlist ? 'secondary' : 'primary'}
																	size="sm"
																	class="rounded-[var(--app-radius-pill)]"
																	on:click={() =>
																		inWishlist
																			? removeGroupFromWishlist([course], $wishlistSet)
																			: addCourse(course.id, inWishlist, inSelected)}
																	disabled={!canWishlistAdd}
																>
																		{inWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
																	</AppButton>
																{#if availability.availability === 'SELECTED'}
																	<AppButton
																		variant="secondary"
																		size="sm"
																		class="rounded-[var(--app-radius-pill)]"
																		on:click={() => dropSelected(course.id)}
																	>
																		{t('panels.selected.drop')}
																	</AppButton>
																	{:else if availability.availability === 'OK_WITH_RESELECT' && $selectedGroupKeySet.has(groupKey as any)}
																		<AppButton
																			variant="secondary"
																			size="sm"
																		class="rounded-[var(--app-radius-pill)]"
																		disabled={!availability.allowed}
																		title={availabilityHint ?? undefined}
																		on:click={() => reselectWithinGroup(groupKey, course.id)}
																	>
																		{t('panels.selected.reselect')}
																	</AppButton>
																{/if}
															{/if}
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
						</ContinuousPager>
					{/if}
				{/if}
			{:else}
				{#if courseCount === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.allCourses.empty')}
					</p>
				{:else}
					{#if $paginationMode === 'paged'}
						<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
							{#each visibleCourses as course, index (course.id)}
								{@const absIndex = windowStartIndex + index}
								{@const inWishlist = $wishlistSet.has(course.id)}
								{@const inSelected = $selectedSet.has(course.id)}
								{@const groupKey = deriveGroupKey(course)}
								{@const canWishlistAdd = !inWishlist ? canAddToWishlist(course.id) : true}
								{@const availability = getAvailability(course.id)}
								{@const availabilityHint =
									availability.availability !== 'OK_NO_RESCHEDULE'
										? getAvailabilityHint(availability, t)
										: null}
								{@const meta = $filterMeta.get(course.id)}
								{@const conflictItems = meta?.diagnostics?.length
									? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
									: null}
								{@const showConflictBadges = $filters.showConflictBadges}
								<CourseCard
									id={course.id}
									title={course.title}
									teacher={course.teacher}
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
									toneIndex={absIndex}
									showConflictBadge={showConflictBadges && Boolean(conflictItems)}
									conflictDetails={showConflictBadges ? conflictItems : null}
								>
									<svelte:fragment slot="meta-controls">
										<CardBulkCheckbox
											checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
											ariaLabel={t('panels.allCourses.bulk.selectSection').replace('{name}', course.title)}
											on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
										/>
									</svelte:fragment>
									<CardActionBar slot="actions" class="justify-start">
										{#if !autoSolveEnabled}
											<AppButton
												variant={inWishlist ? 'secondary' : 'primary'}
												size="sm"
												class="rounded-[var(--app-radius-pill)]"
												on:click={() =>
													inWishlist
														? removeGroupFromWishlist([course], $wishlistSet)
														: addCourse(course.id, inWishlist, inSelected)}
												disabled={!canWishlistAdd}
											>
												{inWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
											</AppButton>
											{#if availability.availability === 'SELECTED'}
												<AppButton
													variant="secondary"
													size="sm"
													class="rounded-[var(--app-radius-pill)]"
													on:click={() => dropSelected(course.id)}
												>
													{t('panels.selected.drop')}
												</AppButton>
												{:else if availability.availability === 'OK_WITH_RESELECT' && $selectedGroupKeySet.has(groupKey as any)}
													<AppButton
														variant="secondary"
														size="sm"
													class="rounded-[var(--app-radius-pill)]"
													disabled={!availability.allowed}
													title={availabilityHint ?? undefined}
													on:click={() => reselectWithinGroup(groupKey, course.id)}
												>
													{t('panels.selected.reselect')}
												</AppButton>
											{/if}
										{/if}
										{#if availabilityHint}
											<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{availabilityHint}
											</span>
										{/if}
									</CardActionBar>
								</CourseCard>
							{/each}
						</div>
					{:else}
						<ContinuousPager
							items={$filteredCourses}
							pageSize={pageSizeValue}
							neighbors={$pageNeighbors}
							{scrollRoot}
							bind:activePage={continuousActivePage}
							let:page
						>
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each page.items as course, index (course.id)}
									{@const absIndex = page.start + index}
									{@const inWishlist = $wishlistSet.has(course.id)}
									{@const inSelected = $selectedSet.has(course.id)}
									{@const groupKey = deriveGroupKey(course)}
									{@const canWishlistAdd = !inWishlist ? canAddToWishlist(course.id) : true}
									{@const availability = getAvailability(course.id)}
									{@const availabilityHint =
										availability.availability !== 'OK_NO_RESCHEDULE'
											? getAvailabilityHint(availability, t)
											: null}
									{@const meta = $filterMeta.get(course.id)}
									{@const conflictItems = meta?.diagnostics?.length
										? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
										: null}
									{@const showConflictBadges = $filters.showConflictBadges}
									<CourseCard
										id={course.id}
										title={course.title}
										teacher={course.teacher}
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
										toneIndex={absIndex}
										showConflictBadge={showConflictBadges && Boolean(conflictItems)}
										conflictDetails={showConflictBadges ? conflictItems : null}
									>
										<svelte:fragment slot="meta-controls">
											<CardBulkCheckbox
												checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
												ariaLabel={t('panels.allCourses.bulk.selectSection').replace('{name}', course.title)}
												on:toggle={() =>
													(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
											/>
										</svelte:fragment>
										<CardActionBar slot="actions" class="justify-start">
											{#if !autoSolveEnabled}
												<AppButton
													variant={inWishlist ? 'secondary' : 'primary'}
													size="sm"
													class="rounded-[var(--app-radius-pill)]"
													on:click={() =>
														inWishlist
															? removeGroupFromWishlist([course], $wishlistSet)
															: addCourse(course.id, inWishlist, inSelected)}
													disabled={!canWishlistAdd}
												>
													{inWishlist ? t('panels.allCourses.removeGroup') : t('panels.allCourses.addGroup')}
												</AppButton>
												{#if availability.availability === 'SELECTED'}
													<AppButton
														variant="secondary"
														size="sm"
														class="rounded-[var(--app-radius-pill)]"
														on:click={() => dropSelected(course.id)}
													>
														{t('panels.selected.drop')}
													</AppButton>
												{:else if availability.availability === 'OK_WITH_RESELECT' && $selectedGroupKeySet.has(groupKey as any)}
													<AppButton
														variant="secondary"
														size="sm"
														class="rounded-[var(--app-radius-pill)]"
														disabled={!availability.allowed}
														title={availabilityHint ?? undefined}
														on:click={() => reselectWithinGroup(groupKey, course.id)}
													>
														{t('panels.selected.reselect')}
													</AppButton>
												{/if}
											{/if}
											{#if availabilityHint}
												<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{availabilityHint}
												</span>
											{/if}
										</CardActionBar>
									</CourseCard>
								{/each}
							</div>
						</ContinuousPager>
					{/if}
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
	{#if bulkMessage}
		<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{bulkMessage}</p>
	{/if}
	</ListSurface>
	</DockPanelShell>
