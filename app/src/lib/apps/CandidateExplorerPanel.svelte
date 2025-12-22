<svelte:options runes={false} />

<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import ContinuousPager from '$lib/components/ContinuousPager.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import CardBulkCheckbox from '$lib/components/CardBulkCheckbox.svelte';
	import CourseBulkControls from '$lib/components/CourseBulkControls.svelte';
	import AutoSolveSettingsDialog from '$lib/components/AutoSolveSettingsDialog.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppPagination from '$lib/primitives/AppPagination.svelte';
	import { translator } from '$lib/i18n';
	import { getAvailabilityHint } from '$lib/utils/availabilityHints';
	import { requestWorkspacePanelFocus } from '$lib/utils/workspaceFocus';
	import { bulkClear, bulkHas, bulkSetAll, bulkToggle, type CourseBulkItem } from '$lib/utils/courseBulk';
	import { dispatchTermAction, setAutoSolveEnabled, termState, type DispatchResult } from '$lib/stores/termStateStore';
	import { scheduleAutoSolveRun } from '$lib/stores/autoSolveRunScheduler';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { courseCatalogMap } from '$lib/data/catalog/courseCatalog';
	import { deriveGroupKey } from '$lib/data/termState/groupKey';
	import type { GroupKey } from '$lib/data/termState/types';
	import {
		collapseByName,
		filteredCourses,
		groupedEntries,
		getGroupEntries,
		expandedCourse,
		expandedGroups,
		filters,
		wishlistGroupKeySet,
		wishlistSet,
		selectedSet,
		selectedGroupKeySet,
		filterMeta,
		handleHover,
		handleLeave,
		toggleVariantList,
		toggleGroup,
		selectFromWishlist,
		removeCourse,
		removeAll,
		getVariantList,
		getAvailability,
	} from './CandidateExplorerPanel.state';

	let currentPage = 1;
	let continuousActivePage = 1;
	let lastMode: 'paged' | 'continuous' | null = null;
	let scrollRoot: HTMLElement | null = null;
	let contentSignature = '';
	let showPaginationFooter = false;

	let t = (key: string) => key;
	$: t = $translator;
	$: autoSolveEnabled = $termState?.settings.autoSolveEnabled ?? false;
	$: autoSolveDisabled = ($termState?.settings.selectionMode ?? null) === 'overflowSpeedRaceMode';

	type BulkItem = CourseBulkItem<'group' | 'section'>;
	type BulkAction = 'select' | 'remove' | 'importSolver';

	let bulkSelection = new Map<string, BulkItem>();
	let bulkAction: BulkAction = 'select';
	let bulkMessage = '';
	let bulkBusy = false;
	let autoSolveDialogOpen = false;

		const clearButtonClass = 'rounded-[var(--app-radius-md)] px-3';
		const actionBarClass = 'flex flex-wrap items-center gap-2 justify-end';
		const variantActionsClass = 'mt-2 flex flex-wrap items-center gap-2 text-[var(--app-text-sm)]';
		const groupDenseActionBarClass =
			'flex flex-wrap items-center gap-x-[var(--app-space-1)] gap-y-0 justify-end';
		const denseVariantActionsClass =
			'flex flex-wrap items-center gap-x-[var(--app-space-1)] gap-y-0 text-[var(--app-text-sm)]';
	const variantsMenuClass =
		'mt-3 flex flex-col gap-1 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-3';
	const variantMenuButtonClass =
		'flex flex-col rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] px-3 py-2 text-left text-[var(--app-text-sm)] text-[var(--app-color-fg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_94%,#000)]';
	const contentContainerClass =
		'flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]';

	$: pageSizeValue = Math.max(1, $pageSize || 1);
	$: groupedAll = $collapseByName ? $groupedEntries : [];
	$: groupedAllMap = new Map(groupedAll);

	$: totalItems = $collapseByName ? groupedAll.length : $filteredCourses.length;
	$: totalPages = Math.max(1, Math.ceil(totalItems / pageSizeValue));
	$: showPaginationFooter = $paginationMode === 'paged' && totalPages > 1;

	$: {
		const sig = `${$collapseByName ? 'group' : 'course'}:${totalItems}`;
		if (sig !== contentSignature) {
			contentSignature = sig;
			currentPage = 1;
			continuousActivePage = 1;
		}
	}

	$: if ($paginationMode !== lastMode) {
		if ($paginationMode === 'continuous') continuousActivePage = Math.max(1, Math.min(totalPages, currentPage));
		else currentPage = Math.max(1, Math.min(totalPages, continuousActivePage));
		lastMode = $paginationMode;
	}

	$: effectiveNeighbors = Math.max(0, Math.floor($pageNeighbors ?? 0));
	$: windowPageMin =
		$paginationMode === 'paged' ? currentPage : Math.max(1, continuousActivePage - effectiveNeighbors);
	$: windowPageMax =
		$paginationMode === 'paged' ? currentPage : Math.min(totalPages, continuousActivePage + effectiveNeighbors);
	$: windowStartIndex = (windowPageMin - 1) * pageSizeValue;
	$: windowEndIndex = Math.min(totalItems, windowPageMax * pageSizeValue);

	$: visibleCourses = $collapseByName
		? []
		: $filteredCourses.slice(windowStartIndex, $paginationMode === 'paged' ? windowStartIndex + pageSizeValue : windowEndIndex);

	$: visibleGroups = $collapseByName
		? groupedAll.slice(windowStartIndex, $paginationMode === 'paged' ? windowStartIndex + pageSizeValue : windowEndIndex)
		: [];
	$: bulkCount = bulkSelection.size;
	$: bulkSelectAllLabel =
		$paginationMode === 'paged' && totalPages > 1
			? t('panels.candidates.bulk.selectPage')
			: t('panels.candidates.bulk.selectAll');

	$: bulkActionOptions = [
		{
			value: 'select',
			label: autoSolveEnabled ? t('panels.candidates.autoTargetAdd') : t('panels.candidates.bulk.actions.select')
		},
		{ value: 'remove', label: t('panels.candidates.bulk.actions.remove') },
		{ value: 'importSolver', label: t('panels.candidates.bulk.actions.importSolver') }
	];

	function clearBulkSelection() {
		bulkSelection = bulkClear();
		bulkMessage = '';
		bulkBusy = false;
	}

	function toggleAutoSolveEnabled() {
		void setAutoSolveEnabled(!autoSolveEnabled);
	}

	function triggerAutoSolveRunNow() {
		scheduleAutoSolveRun({ mode: 'merge', onError: (message) => (bulkMessage = message) });
	}

	async function toggleGroupSelection(groupKey: GroupKey) {
		const isSelected = $wishlistGroupKeySet.has(groupKey as any);
		if (isSelected) {
			await dispatchTermAction({ type: 'SEL_DEMOTE_GROUP', groupKey: groupKey as any, to: 'all' });
			return;
		}
		const result = await dispatchTermAction({ type: 'SEL_PROMOTE_GROUP', groupKey: groupKey as any, to: 'wishlist' });
		if (result.ok && autoSolveEnabled && !autoSolveDisabled) triggerAutoSolveRunNow();
	}

	function selectAllFiltered() {
		const items: BulkItem[] = [];
		if ($collapseByName) {
			for (const [groupKey, groupCourses] of visibleGroups) {
				items.push({ kind: 'group', key: groupKey });
				if (!autoSolveEnabled && $expandedGroups.has(groupKey)) {
					for (const course of groupCourses) {
						items.push({ kind: 'section', key: course.id });
					}
				}
			}
		} else {
			if (autoSolveEnabled) {
				for (const course of visibleCourses) {
					items.push({ kind: 'group', key: deriveGroupKey(course) });
				}
			} else {
				for (const course of visibleCourses) {
					items.push({ kind: 'section', key: course.id });
				}
			}
		}
		bulkSelection = bulkSetAll(items);
		bulkMessage = '';
	}

	async function executeBulk() {
		if (!bulkSelection.size || bulkBusy) return;
		bulkBusy = true;
		bulkMessage = '';

		const items = Array.from(bulkSelection.values());
			try {
				if (bulkAction === 'importSolver') {
					const groupKeys = new Set<GroupKey>();

					for (const item of items) {
						if (item.kind === 'section') {
							const entry = courseCatalogMap.get(item.key as any) ?? null;
							if (entry) groupKeys.add(deriveGroupKey(entry));
							continue;
						}

						const groupKey = item.key as any as GroupKey;
						groupKeys.add(groupKey);
					}

					const entryIds = new Set<string>();
					for (const groupKey of groupKeys) {
						for (const entry of getGroupEntries(groupKey)) entryIds.add(entry.id);
					}

					const stagingItems: Array<{ kind: 'group'; key: GroupKey } | { kind: 'section'; key: string }> = [];
					for (const groupKey of groupKeys) stagingItems.push({ kind: 'group', key: groupKey });
					for (const entryId of entryIds) stagingItems.push({ kind: 'section', key: entryId });

					const staged = await dispatchTermAction({ type: 'SOLVER_STAGING_ADD_MANY', items: stagingItems as any });
					if (!staged.ok) {
						bulkMessage = staged.error.message;
						return;
					}
					requestWorkspacePanelFocus('solver');
					clearBulkSelection();
					return;
				}

			if (bulkAction === 'remove') {
				const sectionEntryIds: string[] = [];
				const groupKeys: GroupKey[] = [];
				for (const item of items) {
					if (item.kind === 'section') sectionEntryIds.push(item.key);
					else groupKeys.push(item.key as unknown as GroupKey);
				}

				const dispatches: Promise<unknown>[] = [];
				if (sectionEntryIds.length) {
					dispatches.push(dispatchTermAction({ type: 'SEL_UNWISHLIST_SECTION_MANY', entryIds: sectionEntryIds as any }));
				}
				for (const groupKey of groupKeys) dispatches.push(removeGroupByKey(groupKey));
				await Promise.all(dispatches);
				clearBulkSelection();
				return;
			}

			// select
			if (autoSolveEnabled) {
				const groupKeys = new Set<GroupKey>();
				for (const item of items) {
					if (item.kind === 'group') {
						groupKeys.add(item.key as any);
						continue;
					}
					const entry = courseCatalogMap.get(item.key);
					if (entry) groupKeys.add(deriveGroupKey(entry));
				}
				let added = 0;
				let skipped = 0;
				const dispatches: Array<Promise<DispatchResult>> = [];
				for (const groupKey of groupKeys) {
					if ($wishlistGroupKeySet.has(groupKey as any)) continue;
					const primary = getGroupEntries(groupKey)[0] ?? null;
					const blocked = primary ? Boolean($filterMeta.get(primary.id)?.currentImpossible) : false;
					if (blocked) {
						skipped += 1;
						continue;
					}
					dispatches.push(dispatchTermAction({ type: 'SEL_PROMOTE_GROUP', groupKey: groupKey as any, to: 'wishlist' }));
				}
				if (dispatches.length) {
					const results = await Promise.all(dispatches);
					for (const result of results) {
						if (result.ok) added += 1;
					}
				}
				if (added && !autoSolveDisabled) triggerAutoSolveRunNow();
				clearBulkSelection();
				if (added || skipped) {
					bulkMessage = t('panels.candidates.bulk.autoTargetResult')
						.replace('{added}', String(added))
						.replace('{skipped}', String(skipped));
				}
				return;
			}

			let skippedGroups = 0;
			for (const item of items) {
				if (item.kind === 'section') {
					selectFromWishlist(item.key);
					continue;
				}
				skippedGroups += 1;
			}
			bulkSelection = bulkClear();
			bulkMessage = skippedGroups ? t('panels.candidates.bulk.groupSelectUnsupported').replace('{count}', String(skippedGroups)) : '';
		} finally {
			bulkBusy = false;
		}
	}

	function handlePageChange(page: number) {
		currentPage = Math.max(1, Math.min(totalPages, page));
	}

	const formatVariantCount = (count: number) =>
		t('panels.allCourses.variantCountLabel').replace('{count}', String(count));

	function getConflictDetails(courseId: string) {
		const meta = $filterMeta.get(courseId);
		if (!$filters.showConflictBadges) return null;
		if (!meta?.diagnostics?.length) return null;
		return meta.diagnostics.map((d) => ({
			label: d.label,
			value: d.reason
		}));
	}

	function getGroupConflictDetails(courseId: string) {
		const details = getConflictDetails(courseId);
		if (!details) return null;
		const filtered = details.filter((d) => d.label !== 'hard-time-conflict');
		return filtered.length ? filtered : null;
	}

	async function dropSelected(entryId: string) {
		await dispatchTermAction({ type: 'SEL_DROP_SELECTED_SECTION', entryId: entryId as any });
	}

	async function removeGroupByKey(groupKey: GroupKey) {
		const courses = groupedAllMap.get(groupKey) ?? [];
		const entryIds = courses.map((course) => course.id);
		await Promise.all([
			dispatchTermAction({ type: 'SEL_DEMOTE_GROUP', groupKey, to: 'all' }),
			entryIds.length ? dispatchTermAction({ type: 'SEL_UNWISHLIST_SECTION_MANY', entryIds: entryIds as any }) : Promise.resolve()
		]);
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={autoSolveEnabled ? t('panels.candidates.autoTitle') : t('panels.candidates.title')}
		subtitle={autoSolveEnabled ? t('panels.candidates.autoDescription') : t('panels.candidates.description')}
		count={totalItems}
		density="comfortable"
		enableStickyToggle={true}
		bodyScrollable={true}
		bind:scrollRoot
	>
		<svelte:fragment slot="header-actions">
			<AppButton
				variant="danger"
				size="sm"
				class={clearButtonClass}
				on:click={removeAll}
				disabled={$wishlistSet.size === 0 && $wishlistGroupKeySet.size === 0}
			>
				{t('panels.candidates.clear')}
			</AppButton>
				<CourseBulkControls
					busy={bulkBusy}
					selectAllLabel={bulkSelectAllLabel}
				clearSelectionLabel={t('panels.candidates.bulk.clearSelection')}
				countLabel={t('panels.candidates.bulk.label').replace('{count}', String(bulkCount))}
				actionOptions={bulkActionOptions}
				bind:action={bulkAction}
				executeLabel={t('panels.candidates.bulk.execute')}
				workingLabel={t('panels.candidates.bulk.working')}
				disableSelectAll={totalItems === 0}
				disableClear={bulkCount === 0}
				disableExecute={bulkCount === 0}
				onSelectAll={selectAllFiltered}
					onClearSelection={clearBulkSelection}
					onExecute={executeBulk}
				/>
				<AppButton
					variant={autoSolveEnabled ? 'primary' : 'secondary'}
					size="sm"
					disabled={autoSolveDisabled}
					title={autoSolveDisabled ? t('dialogs.autoSolve.disabledSpeedRace') : undefined}
					on:click={toggleAutoSolveEnabled}
				>
					{t('panels.common.autoSolve.toggle')}
				</AppButton>
				<AppButton variant="secondary" size="sm" on:click={() => (autoSolveDialogOpen = true)}>
					{t('panels.common.autoSolve.settings')}
				</AppButton>
			</svelte:fragment>

			<svelte:fragment slot="filters">
				<CourseFiltersToolbar
					{filters}
					options={filterOptions}
					mode="wishlist"
					statusModeScope={autoSolveEnabled ? 'none' : 'auto'}
				/>
			</svelte:fragment>

		<div class={contentContainerClass}>
			{#if $collapseByName}
				{#if totalItems === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.candidates.empty')}
					</p>
				{:else}
					{#if $paginationMode === 'paged'}
						<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each visibleGroups as [groupKey, groupCourses], groupIndex (groupKey)}
									{@const absIndex = windowStartIndex + groupIndex}
									{@const variants = getGroupEntries(groupKey)}
									{@const primary = variants[0] ?? groupCourses[0]}
									{@const expanded = $expandedGroups.has(groupKey)}
										{@const isTargetGroup = $wishlistGroupKeySet.has(groupKey as any)}
									{@const primaryMeta = $filterMeta.get(primary.id)}
									{@const groupConflictDetails = getGroupConflictDetails(primary.id)}
									{@const autoTargetBlocked = Boolean(primaryMeta?.currentImpossible)}
									{@const canRemoveGroup = isTargetGroup || groupCourses.length > 0}
									<div class="flex flex-col gap-2 px-3 py-2">
											<CourseCard
											id={primary.id}
											density="dense"
											title={primary.title ?? String(groupKey)}
											teacher={variants.length === 1 ? primary.teacher : null}
											time={primary.slot ?? t('courseCard.noTime')}
											courseCode={primary.courseCode}
											credit={primary.credit ?? null}
											colorSeed={primary.id}
										showTime={false}
										hoverable={variants.length === 1}
											onHover={variants.length === 1 ? () => handleHover(primary) : undefined}
											onLeave={variants.length === 1 ? handleLeave : undefined}
											toneIndex={absIndex}
										showConflictBadge={Boolean(groupConflictDetails)}
										conflictDetails={groupConflictDetails}
									>
									<svelte:fragment slot="meta-controls">
										<CardBulkCheckbox
											checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
											ariaLabel={t('panels.candidates.bulk.selectGroup').replace('{name}', primary.title ?? String(groupKey))}
											on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
										/>
									</svelte:fragment>
								<CardActionBar slot="actions" class={groupDenseActionBarClass}>
									<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
										{formatVariantCount(variants.length)}
									</span>
									{#if autoSolveEnabled}
										<AppButton
											variant={isTargetGroup ? 'secondary' : 'primary'}
											size="sm"
											disabled={!isTargetGroup && autoTargetBlocked}
											title={!isTargetGroup && autoTargetBlocked ? t('panels.candidates.autoTargetBlocked') : undefined}
											on:click={() => toggleGroupSelection(groupKey)}
										>
											{isTargetGroup ? t('panels.candidates.autoTargetRemove') : t('panels.candidates.autoTargetAdd')}
										</AppButton>
									{/if}
										<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
											{expanded ? t('panels.candidates.toggleMore.collapse') : t('panels.candidates.toggleMore.expand')}
										</AppButton>
										{#if canRemoveGroup}
											<AppButton variant="secondary" size="sm" on:click={() => removeGroupByKey(groupKey)}>
												{t('panels.candidates.removeGroup')}
											</AppButton>
										{/if}
									</CardActionBar>
								</CourseCard>
									{#if expanded}
										<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
												{#each variants as course, variantIndex (course.id)}
													{@const inWishlist = $wishlistSet.has(course.id)}
													{@const isSelected = $selectedSet.has(course.id)}
													{@const canReselect = $selectedGroupKeySet.has(groupKey as any)}
													{@const conflictDetails = getConflictDetails(course.id)}
													{@const availability = getAvailability(course.id)}
													{@const availabilityHint = getAvailabilityHint(availability, t)}
														<CourseCard
															id={course.id}
															density="dense"
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
													toneIndex={absIndex + variantIndex}
													showConflictBadge={Boolean(conflictDetails)}
												conflictDetails={conflictDetails}
											>
												<svelte:fragment slot="meta-controls">
													{#if inWishlist && !autoSolveEnabled}
														<CardBulkCheckbox
															checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
															ariaLabel={t('panels.candidates.bulk.selectSection').replace('{name}', course.title)}
															on:toggle={() =>
																(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
														/>
													{/if}
												</svelte:fragment>
													{#if !autoSolveEnabled}
														<CardActionBar slot="actions" class={denseVariantActionsClass}>
															{#if isSelected}
																<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
																	{t('panels.selected.drop')}
																</AppButton>
																{:else}
																	{#if canReselect}
																		<AppButton
																			variant="primary"
																			size="sm"
																			disabled={!availability.allowed}
																		title={availabilityHint ?? undefined}
																		on:click={() =>
																			dispatchTermAction({
																				type: 'SEL_RESELECT_WITHIN_GROUP',
																				groupKey: groupKey as any,
																				nextEntryId: course.id as any
																			})}
																	>
																		{t('panels.selected.reselect')}
																	</AppButton>
																{:else}
																	<AppButton
																		variant="primary"
																		size="sm"
																		disabled={!availability.allowed}
																		title={availabilityHint ?? undefined}
																		on:click={() => selectFromWishlist(course.id)}
																	>
																		{t('panels.candidates.select')}
																	</AppButton>
																{/if}
															{/if}
															{#if inWishlist}
																<AppButton variant="secondary" size="sm" on:click={() => removeCourse(course.id)}>
																	{t('panels.candidates.removeGroup')}
																</AppButton>
															{/if}
															{#if availabilityHint}
																<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
																	{availabilityHint}
																</span>
															{/if}
														</CardActionBar>
													{/if}
												</CourseCard>
											{/each}
										</div>
								{/if}
							</div>
						{/each}
					</div>
					{:else}
						<ContinuousPager
							items={groupedAll}
							pageSize={pageSizeValue}
							neighbors={$pageNeighbors}
							{scrollRoot}
							bind:activePage={continuousActivePage}
							let:page
						>
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each page.items as [groupKey, groupCourses], groupIndex (groupKey)}
									{@const absIndex = page.start + groupIndex}
									{@const variants = getGroupEntries(groupKey)}
									{@const primary = variants[0] ?? groupCourses[0]}
									{@const expanded = $expandedGroups.has(groupKey)}
									{@const isTargetGroup = $wishlistGroupKeySet.has(groupKey as any)}
									{@const primaryMeta = $filterMeta.get(primary.id)}
									{@const groupConflictDetails = getGroupConflictDetails(primary.id)}
									{@const autoTargetBlocked = Boolean(primaryMeta?.currentImpossible)}
									{@const canRemoveGroup = isTargetGroup || groupCourses.length > 0}
									<div class="flex flex-col gap-2 px-3 py-2">
										<CourseCard
											id={primary.id}
											density="dense"
											title={primary.title ?? String(groupKey)}
											teacher={variants.length === 1 ? primary.teacher : null}
											time={primary.slot ?? t('courseCard.noTime')}
											courseCode={primary.courseCode}
											credit={primary.credit ?? null}
											colorSeed={primary.id}
											showTime={false}
											hoverable={variants.length === 1}
											onHover={variants.length === 1 ? () => handleHover(primary) : undefined}
											onLeave={variants.length === 1 ? handleLeave : undefined}
											toneIndex={absIndex}
										showConflictBadge={Boolean(groupConflictDetails)}
										conflictDetails={groupConflictDetails}
										>
											<svelte:fragment slot="meta-controls">
												<CardBulkCheckbox
													checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
													ariaLabel={t('panels.candidates.bulk.selectGroup').replace(
														'{name}',
														primary.title ?? String(groupKey)
													)}
													on:toggle={() =>
														(bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
												/>
											</svelte:fragment>
											<CardActionBar slot="actions" class={groupDenseActionBarClass}>
												<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
													{formatVariantCount(variants.length)}
												</span>
												{#if autoSolveEnabled}
													<AppButton
														variant={isTargetGroup ? 'secondary' : 'primary'}
														size="sm"
														disabled={!isTargetGroup && autoTargetBlocked}
														title={!isTargetGroup && autoTargetBlocked ? t('panels.candidates.autoTargetBlocked') : undefined}
														on:click={() => toggleGroupSelection(groupKey)}
													>
														{isTargetGroup ? t('panels.candidates.autoTargetRemove') : t('panels.candidates.autoTargetAdd')}
													</AppButton>
												{/if}
												<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey)}>
													{expanded
														? t('panels.candidates.toggleMore.collapse')
														: t('panels.candidates.toggleMore.expand')}
												</AppButton>
												{#if canRemoveGroup}
													<AppButton variant="secondary" size="sm" on:click={() => removeGroupByKey(groupKey)}>
														{t('panels.candidates.removeGroup')}
													</AppButton>
												{/if}
											</CardActionBar>
										</CourseCard>
										{#if expanded}
											<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
												{#each variants as course, variantIndex (course.id)}
													{@const inWishlist = $wishlistSet.has(course.id)}
													{@const isSelected = $selectedSet.has(course.id)}
													{@const canReselect = $selectedGroupKeySet.has(groupKey as any)}
													{@const conflictDetails = getConflictDetails(course.id)}
													{@const availability = getAvailability(course.id)}
													{@const availabilityHint = getAvailabilityHint(availability, t)}
													<CourseCard
														id={course.id}
														density="dense"
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
														toneIndex={absIndex + variantIndex}
														showConflictBadge={Boolean(conflictDetails)}
														conflictDetails={conflictDetails}
													>
														<svelte:fragment slot="meta-controls">
															{#if inWishlist && !autoSolveEnabled}
																<CardBulkCheckbox
																	checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
																	ariaLabel={t('panels.candidates.bulk.selectSection').replace(
																		'{name}',
																		course.title
																	)}
																	on:toggle={() =>
																		(bulkSelection = bulkToggle(bulkSelection, {
																			kind: 'section',
																			key: course.id
																		}))}
																/>
															{/if}
														</svelte:fragment>
														{#if !autoSolveEnabled}
															<CardActionBar slot="actions" class={denseVariantActionsClass}>
																{#if isSelected}
																	<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
																		{t('panels.selected.drop')}
																	</AppButton>
																{:else}
																	{#if canReselect}
																		<AppButton
																			variant="primary"
																			size="sm"
																			disabled={!availability.allowed}
																			title={availabilityHint ?? undefined}
																			on:click={() =>
																				dispatchTermAction({
																					type: 'SEL_RESELECT_WITHIN_GROUP',
																					groupKey: groupKey as any,
																					nextEntryId: course.id as any
																				})}
																		>
																			{t('panels.selected.reselect')}
																		</AppButton>
																	{:else}
																		<AppButton
																			variant="primary"
																			size="sm"
																			disabled={!availability.allowed}
																			title={availabilityHint ?? undefined}
																			on:click={() => selectFromWishlist(course.id)}
																		>
																			{t('panels.candidates.select')}
																		</AppButton>
																	{/if}
																{/if}
																	{#if inWishlist}
																		<AppButton variant="secondary" size="sm" on:click={() => removeCourse(course.id)}>
																			{t('panels.candidates.removeGroup')}
																		</AppButton>
																	{/if}
																{#if availabilityHint}
																	<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
																		{availabilityHint}
																	</span>
																{/if}
															</CardActionBar>
														{/if}
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
				{#if !autoSolveEnabled}
					{#if totalItems === 0}
						<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
							{t('panels.candidates.empty')}
						</p>
					{:else}
						{#if $paginationMode === 'paged'}
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each visibleCourses as course, index (course.id)}
									{@const absIndex = windowStartIndex + index}
									{@const conflictDetails = getConflictDetails(course.id)}
									{@const availability = getAvailability(course.id)}
									{@const canReselect = $selectedGroupKeySet.has(deriveGroupKey(course) as any)}
									{@const availabilityHint = getAvailabilityHint(availability, t)}
								<article class="flex flex-col gap-2 px-3 py-3">
										<CourseCard
											id={course.id}
											title={course.title}
											teacher={course.teacher}
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
									toneIndex={absIndex}
									showConflictBadge={Boolean(conflictDetails)}
								conflictDetails={conflictDetails}
							>
									<svelte:fragment slot="meta-controls">
										<CardBulkCheckbox
											checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
											ariaLabel={t('panels.candidates.bulk.selectSection').replace('{name}', course.title)}
											on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
										/>
									</svelte:fragment>
									<CardActionBar slot="actions" class={variantActionsClass}>
										{#if availability.availability === 'SELECTED'}
											<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
												{t('panels.selected.drop')}
											</AppButton>
										{:else}
										{#if canReselect}
											<AppButton
												variant="primary"
												size="sm"
												disabled={!availability.allowed}
												title={availabilityHint ?? undefined}
												on:click={() =>
													dispatchTermAction({
														type: 'SEL_RESELECT_WITHIN_GROUP',
														groupKey: deriveGroupKey(course) as any,
														nextEntryId: course.id as any
													})}
											>
												{t('panels.selected.reselect')}
											</AppButton>
										{:else}
											<AppButton
												variant="primary"
												size="sm"
												disabled={!availability.allowed}
												title={availabilityHint ?? undefined}
												on:click={() => selectFromWishlist(course.id)}
											>
												{t('panels.candidates.select')}
											</AppButton>
										{/if}
										<AppButton variant="secondary" size="sm" on:click={() => removeCourse(course.id)}>
											{t('panels.candidates.removeGroup')}
										</AppButton>
										{#if availabilityHint}
												<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{availabilityHint}
												</span>
											{/if}
										{/if}
										{#if getVariantList(course.id).length > 1}
											<AppButton
												variant="secondary"
											size="sm"
											class={$expandedCourse === course.id ? 'bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]' : ''}
											on:click={() => toggleVariantList(course.id)}
										>
											{$expandedCourse === course.id
												? t('panels.candidates.toggleMore.collapse')
												: t('panels.candidates.toggleMore.expand')}
										</AppButton>
									{/if}
								</CardActionBar>
							</CourseCard>
						{#if $expandedCourse === course.id}
								<div class={variantsMenuClass}>
									{#each getVariantList(course.id) as variant (variant.id)}
										{@const availability = getAvailability(variant.id)}
										{@const availabilityHint = getAvailabilityHint(availability, t)}
										{@const isSelected = availability.availability === 'SELECTED'}
										{@const isReselect =
											availability.availability === 'OK_WITH_RESELECT' &&
											$selectedGroupKeySet.has(deriveGroupKey(variant) as any)}
										<AppButton
											variant="secondary"
											size="sm"
											class={`${variantMenuButtonClass} h-auto py-2 items-stretch`}
											disabled={!isSelected && !availability.allowed}
											title={availabilityHint ?? undefined}
											on:click={() => {
												if (isSelected) {
													return dropSelected(variant.id);
												}
												if (isReselect) {
													return dispatchTermAction({
														type: 'SEL_RESELECT_WITHIN_GROUP',
														groupKey: deriveGroupKey(variant) as any,
														nextEntryId: variant.id as any
													});
												}
												selectFromWishlist(variant.id);
											}}
										>
											<span class="text-[var(--app-text-sm)] font-medium">{variant.slot}</span>
											<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{variant.teacher} · {variant.location}
											</small>
											<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{isSelected
													? t('panels.selected.drop')
													: isReselect
														? t('panels.selected.reselect')
														: t('panels.candidates.select')}
											</small>
											{#if availabilityHint}
												<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{availabilityHint}
												</small>
											{/if}
										</AppButton>
									{/each}
								</div>
							{/if}
						</article>
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
									{@const conflictDetails = getConflictDetails(course.id)}
									{@const availability = getAvailability(course.id)}
									{@const canReselect = $selectedGroupKeySet.has(deriveGroupKey(course) as any)}
									{@const availabilityHint = getAvailabilityHint(availability, t)}
									<article class="flex flex-col gap-2 px-3 py-3">
										<CourseCard
											id={course.id}
											title={course.title}
											teacher={course.teacher}
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
											toneIndex={absIndex}
											showConflictBadge={Boolean(conflictDetails)}
											conflictDetails={conflictDetails}
										>
											<svelte:fragment slot="meta-controls">
												<CardBulkCheckbox
													checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
													ariaLabel={t('panels.candidates.bulk.selectSection').replace('{name}', course.title)}
													on:toggle={() =>
														(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
												/>
											</svelte:fragment>
											<CardActionBar slot="actions" class={variantActionsClass}>
												{#if availability.availability === 'SELECTED'}
													<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
														{t('panels.selected.drop')}
													</AppButton>
												{:else}
													{#if canReselect}
														<AppButton
															variant="primary"
															size="sm"
															disabled={!availability.allowed}
															title={availabilityHint ?? undefined}
															on:click={() =>
																dispatchTermAction({
																	type: 'SEL_RESELECT_WITHIN_GROUP',
																	groupKey: deriveGroupKey(course) as any,
																	nextEntryId: course.id as any
																})}
														>
															{t('panels.selected.reselect')}
														</AppButton>
													{:else}
														<AppButton
															variant="primary"
															size="sm"
															disabled={!availability.allowed}
															title={availabilityHint ?? undefined}
															on:click={() => selectFromWishlist(course.id)}
														>
															{t('panels.candidates.select')}
														</AppButton>
													{/if}
													<AppButton variant="secondary" size="sm" on:click={() => removeCourse(course.id)}>
														{t('panels.candidates.removeGroup')}
													</AppButton>
													{#if availabilityHint}
														<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															{availabilityHint}
														</span>
													{/if}
												{/if}
												{#if getVariantList(course.id).length > 1}
													<AppButton
														variant="secondary"
														size="sm"
														class={$expandedCourse === course.id
															? 'bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]'
															: ''}
														on:click={() => toggleVariantList(course.id)}
													>
														{$expandedCourse === course.id
															? t('panels.candidates.toggleMore.collapse')
															: t('panels.candidates.toggleMore.expand')}
													</AppButton>
												{/if}
											</CardActionBar>
										</CourseCard>
										{#if $expandedCourse === course.id}
											<div class={variantsMenuClass}>
												{#each getVariantList(course.id) as variant (variant.id)}
										{@const availability = getAvailability(variant.id)}
										{@const availabilityHint = getAvailabilityHint(availability, t)}
										{@const isSelected = availability.availability === 'SELECTED'}
										{@const isReselect =
											availability.availability === 'OK_WITH_RESELECT' &&
											$selectedGroupKeySet.has(deriveGroupKey(variant) as any)}
										<AppButton
											variant="secondary"
											size="sm"
														class={`${variantMenuButtonClass} h-auto py-2 items-stretch`}
														disabled={!isSelected && !availability.allowed}
														title={availabilityHint ?? undefined}
														on:click={() => {
															if (isSelected) {
																return dropSelected(variant.id);
															}
															if (isReselect) {
																return dispatchTermAction({
																	type: 'SEL_RESELECT_WITHIN_GROUP',
																	groupKey: deriveGroupKey(variant) as any,
																	nextEntryId: variant.id as any
																});
															}
															selectFromWishlist(variant.id);
														}}
													>
														<span class="text-[var(--app-text-sm)] font-medium">{variant.slot}</span>
														<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															{variant.teacher} · {variant.location}
														</small>
														<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															{isSelected
																? t('panels.selected.drop')
																: isReselect
																	? t('panels.selected.reselect')
																	: t('panels.candidates.select')}
														</small>
														{#if availabilityHint}
															<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
																{availabilityHint}
															</small>
														{/if}
													</AppButton>
												{/each}
											</div>
										{/if}
									</article>
									{/each}
								</div>
							</ContinuousPager>
						{/if}
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

<AutoSolveSettingsDialog open={autoSolveDialogOpen} onClose={() => (autoSolveDialogOpen = false)} />
