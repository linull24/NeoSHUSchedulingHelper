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
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import AppPagination from '$lib/primitives/AppPagination.svelte';
	import { translator } from '$lib/i18n';
	import { requestWorkspacePanelFocus } from '$lib/utils/workspaceFocus';
	import { bulkClear, bulkHas, bulkSetAll, bulkToggle, type CourseBulkItem } from '$lib/utils/courseBulk';
	import { dispatchTermAction, setAutoSolveEnabled, termState } from '$lib/stores/termStateStore';
	import { getFilterOptionsForScope } from '$lib/stores/courseFilters';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { courseCatalogMap } from '$lib/data/catalog/courseCatalog';
	import { selectedCourseIds } from '$lib/stores/courseSelection';
	import { deriveGroupKey } from '$lib/data/termState/groupKey';
	import type { GroupKey } from '$lib/data/termState/types';

	import {
		collapseByName,
		selectedCourses,
		groupedEntries,
		getGroupEntries,
		expandedGroups,
		hasOrphanSelected,
		filters,
		filterMeta,
		handleHover,
		handleLeave,
		toggleGroup
	} from './SelectedCoursesPanel.state';

	let currentPage = 1;
	let continuousActivePage = 1;
	let lastMode: 'paged' | 'continuous' | null = null;
	let scrollRoot: HTMLElement | null = null;
	let contentSignature = '';
	let showPaginationFooter = false;

	let reselectDialogOpen = false;
	let reselectDialogGroupKey: GroupKey | null = null;
	let reselectDialogCurrentId: string | null = null;
	let reselectDialogEntryId: string | null = null;
	let autoSolveDialogOpen = false;

	type BulkItem = CourseBulkItem<'group' | 'section'>;
	type BulkAction = 'demote' | 'importSolver';

	let bulkSelection = new Map<string, BulkItem>();
	let bulkAction: BulkAction = 'demote';
	let bulkBusy = false;
	let bulkMessage = '';

	let t = (key: string) => key;
	$: t = $translator;
	$: autoSolveEnabled = $termState?.settings.autoSolveEnabled ?? false;
	$: bulkCount = bulkSelection.size;

	const actionBarClass = 'flex flex-wrap items-center gap-2 justify-end';
	const variantActionsClass = 'mt-2 flex flex-wrap items-center gap-2 text-[var(--app-text-sm)]';
	const groupDenseActionBarClass =
		'flex flex-wrap items-center gap-x-[var(--app-space-1)] gap-y-0 justify-end';
	const denseVariantActionsClass =
		'flex flex-wrap items-center gap-x-[var(--app-space-1)] gap-y-0 text-[var(--app-text-sm)]';
	const contentContainerClass =
		'flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]';

	$: pageSizeValue = Math.max(1, $pageSize || 1);
	$: groupedAll = $collapseByName ? $groupedEntries : [];
	$: totalItems = $collapseByName ? groupedAll.length : $selectedCourses.length;
	$: totalPages = Math.max(1, Math.ceil(totalItems / pageSizeValue));
	$: showPaginationFooter = $paginationMode === 'paged' && totalPages > 1;
	$: bulkSelectAllLabel =
		$paginationMode === 'paged' && totalPages > 1 ? t('panels.selected.bulk.selectPage') : t('panels.selected.bulk.selectAll');

	$: {
		const sig = `${$collapseByName ? 'group' : 'section'}:${totalItems}`;
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

	$: visibleCourses =
		$collapseByName
			? []
			: $paginationMode === 'paged'
				? $selectedCourses.slice(windowStartIndex, windowStartIndex + pageSizeValue)
				: $selectedCourses.slice(windowStartIndex, windowEndIndex);

	$: visibleGroups =
		$collapseByName
			? $paginationMode === 'paged'
				? groupedAll.slice(windowStartIndex, windowStartIndex + pageSizeValue)
				: groupedAll.slice(windowStartIndex, windowEndIndex)
			: [];

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

	async function dropSelected(entryId: string) {
		await dispatchTermAction({ type: 'SEL_DROP_SELECTED_SECTION', entryId: entryId as any });
	}

	async function reselectWithinGroup(groupKey: GroupKey, nextEntryId: string) {
		await dispatchTermAction({
			type: 'SEL_RESELECT_WITHIN_GROUP',
			groupKey: groupKey as any,
			nextEntryId: nextEntryId as any
		});
	}

	function openReselectDialog(groupKey: GroupKey, currentId: string) {
		reselectDialogGroupKey = groupKey;
		reselectDialogCurrentId = currentId;
		const variants = getGroupEntries(groupKey);
		reselectDialogEntryId = variants.find((v) => v.id !== currentId)?.id ?? currentId;
		reselectDialogOpen = true;
	}

	function closeReselectDialog() {
		reselectDialogOpen = false;
		reselectDialogGroupKey = null;
		reselectDialogCurrentId = null;
		reselectDialogEntryId = null;
	}

	async function confirmReselectDialog() {
		if (!reselectDialogGroupKey || !reselectDialogEntryId || !reselectDialogCurrentId) return;
		if (reselectDialogEntryId === reselectDialogCurrentId) {
			closeReselectDialog();
			return;
		}
		await reselectWithinGroup(reselectDialogGroupKey, reselectDialogEntryId);
		closeReselectDialog();
	}

	function toggleAutoSolveEnabled() {
		void (async () => {
			bulkMessage = '';
			const res = await setAutoSolveEnabled(!autoSolveEnabled);
			if (res && !res.ok) bulkMessage = res.error.message;
		})();
	}

	function clearBulkSelection() {
		bulkSelection = bulkClear();
		bulkBusy = false;
		bulkMessage = '';
	}

	function selectAllVisible() {
		const items: BulkItem[] = [];
		if ($collapseByName) {
			for (const [groupKey] of visibleGroups) {
				items.push({ kind: 'group', key: groupKey });
			}
		} else {
			for (const course of visibleCourses) {
				items.push({ kind: 'section', key: course.id });
			}
		}
		bulkSelection = bulkSetAll(items);
		bulkMessage = '';
	}

	async function executeBulk() {
		if (!bulkSelection.size || bulkBusy) return;
		bulkBusy = true;
		bulkMessage = '';
		try {
			const entryIds = new Set<string>();
			for (const item of bulkSelection.values()) {
				if (item.kind === 'section') {
					entryIds.add(item.key);
					continue;
				}
				const groupKey = item.key as unknown as GroupKey;
				const variants = getGroupEntries(groupKey);
				for (const variant of variants) {
					if ($selectedCourseIds.has(variant.id)) entryIds.add(variant.id);
				}
			}

			if (!entryIds.size) {
				clearBulkSelection();
				return;
			}

				if (bulkAction === 'importSolver') {
					const groupKeys = new Set<GroupKey>();
					for (const entryId of entryIds) {
						const entry = courseCatalogMap.get(entryId) ?? null;
						if (entry) groupKeys.add(deriveGroupKey(entry));
					}
					const stageEntryIds = new Set<string>();
					for (const groupKey of groupKeys) {
						for (const entry of getGroupEntries(groupKey)) stageEntryIds.add(entry.id);
					}
					const stagingItems: Array<{ kind: 'group'; key: GroupKey } | { kind: 'section'; key: string }> = [];
					for (const groupKey of groupKeys) stagingItems.push({ kind: 'group', key: groupKey });
					for (const entryId of stageEntryIds) stagingItems.push({ kind: 'section', key: entryId });
					await dispatchTermAction({ type: 'SOLVER_STAGING_ADD_MANY', items: stagingItems as any });
					requestWorkspacePanelFocus('solver');
					clearBulkSelection();
					return;
				}

			// demote
			await dispatchTermAction({ type: 'SEL_DEMOTE_SECTION_MANY', entryIds: Array.from(entryIds) as any, to: 'wishlist' });
			clearBulkSelection();
		} finally {
			bulkBusy = false;
		}
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
		bind:scrollRoot
	>
		<svelte:fragment slot="header-actions">
			<CourseBulkControls
				busy={bulkBusy}
				selectAllLabel={bulkSelectAllLabel}
				clearSelectionLabel={t('panels.selected.bulk.clearSelection')}
				countLabel={t('panels.selected.bulk.label').replace('{count}', String(bulkCount))}
				actionOptions={[
					{ value: 'demote', label: t('panels.selected.bulk.actions.demote') },
					{ value: 'importSolver', label: t('panels.selected.bulk.actions.importSolver') }
				]}
				bind:action={bulkAction}
				executeLabel={t('panels.selected.bulk.execute')}
				workingLabel={t('panels.selected.bulk.working')}
				disableSelectAll={totalItems === 0}
				disableClear={bulkCount === 0}
				disableExecute={bulkCount === 0}
				onSelectAll={selectAllVisible}
				onClearSelection={clearBulkSelection}
				onExecute={executeBulk}
			/>
			<AppButton
				variant={autoSolveEnabled ? 'primary' : 'secondary'}
				size="sm"
				on:click={toggleAutoSolveEnabled}
			>
				{t('panels.common.autoSolve.toggle')}
			</AppButton>
			<AppButton variant="secondary" size="sm" on:click={() => (autoSolveDialogOpen = true)}>
				{t('panels.common.autoSolve.settings')}
			</AppButton>
		</svelte:fragment>

		<svelte:fragment slot="filters">
			<CourseFiltersToolbar {filters} options={getFilterOptionsForScope('current')} mode="selected" hasOrphanSelected={$hasOrphanSelected} />
		</svelte:fragment>

		<div class={contentContainerClass}>
			{#if $collapseByName}
				{#if totalItems === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.selected.empty')}
					</p>
				{:else}
					{#if $paginationMode === 'paged'}
						<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
							{#each visibleGroups as [groupKey, selectedInGroup], groupIndex (groupKey)}
								{@const absIndex = windowStartIndex + groupIndex}
								{@const variants = getGroupEntries(groupKey)}
								{@const primary = selectedInGroup[0] ?? variants[0]}
								{@const expanded = $expandedGroups.has(groupKey)}
								{@const primaryMeta = primary ? $filterMeta.get(primary.id) : null}
								{@const conflictDetails = primary ? getConflictDetails(primary.id) : null}
								<div class="flex flex-col gap-2 px-3 py-2">
									{#if primary}
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
											showConflictBadge={Boolean(conflictDetails)}
											conflictDetails={conflictDetails}
										>
											<CardBulkCheckbox
												slot="meta-controls"
												checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
												ariaLabel={t('panels.selected.bulk.selectGroup').replace(
													'{name}',
													primary.title ?? String(groupKey)
												)}
												on:toggle={() =>
													(bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
											/>
											<CardActionBar slot="actions" class={groupDenseActionBarClass}>
												<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
													{formatVariantCount(variants.length)}
												</span>
												<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey as any)}>
													{expanded
														? t('panels.candidates.toggleMore.collapse')
														: t('panels.candidates.toggleMore.expand')}
												</AppButton>
											</CardActionBar>
										</CourseCard>
									{/if}

									{#if expanded}
											<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
											{#each variants as course, variantIndex (course.id)}
												{@const isSelected = $selectedCourseIds.has(course.id)}
												{@const conflictDetails = isSelected ? getConflictDetails(course.id) : null}
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
													{#if isSelected}
														<CardBulkCheckbox
															slot="meta-controls"
															checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
															ariaLabel={t('panels.selected.bulk.selectSection').replace('{name}', course.title)}
															on:toggle={() =>
																(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
														/>
													{/if}
													<CardActionBar slot="actions" class={denseVariantActionsClass}>
														{#if !autoSolveEnabled}
															{#if isSelected}
																<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
																	{t('panels.selected.drop')}
																</AppButton>
															{:else}
																<AppButton
																	variant="secondary"
																	size="sm"
																	on:click={() => reselectWithinGroup(groupKey, course.id)}
																>
																	{t('panels.selected.reselect')}
																</AppButton>
															{/if}
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
							items={groupedAll}
							pageSize={pageSizeValue}
							neighbors={$pageNeighbors}
							{scrollRoot}
							bind:activePage={continuousActivePage}
							let:page
						>
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each page.items as [groupKey, selectedInGroup], groupIndex (groupKey)}
									{@const absIndex = page.start + groupIndex}
									{@const variants = getGroupEntries(groupKey)}
									{@const primary = selectedInGroup[0] ?? variants[0]}
									{@const expanded = $expandedGroups.has(groupKey)}
									{@const primaryMeta = primary ? $filterMeta.get(primary.id) : null}
									{@const conflictDetails = primary ? getConflictDetails(primary.id) : null}
									<div class="flex flex-col gap-2 px-3 py-2">
										{#if primary}
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
												showConflictBadge={Boolean(conflictDetails)}
												conflictDetails={conflictDetails}
											>
												<CardBulkCheckbox
													slot="meta-controls"
													checked={bulkHas(bulkSelection, { kind: 'group', key: groupKey })}
													ariaLabel={t('panels.selected.bulk.selectGroup').replace(
														'{name}',
														primary.title ?? String(groupKey)
													)}
													on:toggle={() =>
														(bulkSelection = bulkToggle(bulkSelection, { kind: 'group', key: groupKey }))}
												/>
												<CardActionBar slot="actions" class={groupDenseActionBarClass}>
													<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
														{formatVariantCount(variants.length)}
													</span>
													<AppButton variant="secondary" size="sm" on:click={() => toggleGroup(groupKey as any)}>
														{expanded
															? t('panels.candidates.toggleMore.collapse')
															: t('panels.candidates.toggleMore.expand')}
													</AppButton>
												</CardActionBar>
											</CourseCard>
										{/if}

										{#if expanded}
											<div class="flex flex-col gap-2 border-t border-[color:var(--app-color-border-subtle)] pt-2">
												{#each variants as course, variantIndex (course.id)}
													{@const isSelected = $selectedCourseIds.has(course.id)}
													{@const conflictDetails = isSelected ? getConflictDetails(course.id) : null}
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
														{#if isSelected}
															<CardBulkCheckbox
																slot="meta-controls"
																checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
																ariaLabel={t('panels.selected.bulk.selectSection').replace('{name}', course.title)}
																on:toggle={() =>
																	(bulkSelection = bulkToggle(bulkSelection, {
																		kind: 'section',
																		key: course.id
																	}))}
															/>
														{/if}
														<CardActionBar slot="actions" class={denseVariantActionsClass}>
															{#if !autoSolveEnabled}
																{#if isSelected}
																	<AppButton
																		variant="secondary"
																		size="sm"
																		on:click={() => dropSelected(course.id)}
																	>
																		{t('panels.selected.drop')}
																	</AppButton>
																{:else}
																	<AppButton
																		variant="secondary"
																		size="sm"
																		on:click={() => reselectWithinGroup(groupKey, course.id)}
																	>
																		{t('panels.selected.reselect')}
																	</AppButton>
																{/if}
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
				{#if totalItems === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.selected.empty')}
					</p>
				{:else}
					{#if $paginationMode === 'paged'}
						<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
							{#each visibleCourses as course, index (course.id)}
								{@const absIndex = windowStartIndex + index}
								{@const groupKey = deriveGroupKey(course)}
								{@const variants = getGroupEntries(groupKey)}
								{@const conflictDetails = getConflictDetails(course.id)}
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
									<CardBulkCheckbox
										slot="meta-controls"
										checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
										ariaLabel={t('panels.selected.bulk.selectSection').replace('{name}', course.title)}
										on:toggle={() => (bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
									/>
									<CardActionBar slot="actions" class={variantActionsClass}>
										{#if !autoSolveEnabled}
											<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
												{t('panels.selected.drop')}
											</AppButton>
											{#if variants.length > 1}
												<AppButton
													variant="secondary"
													size="sm"
													on:click={() => openReselectDialog(groupKey, course.id)}
												>
													{t('panels.selected.reselect')}
												</AppButton>
											{/if}
										{/if}
									</CardActionBar>
								</CourseCard>
							{/each}
						</div>
					{:else}
						<ContinuousPager
							items={$selectedCourses}
							pageSize={pageSizeValue}
							neighbors={$pageNeighbors}
							{scrollRoot}
							bind:activePage={continuousActivePage}
							let:page
						>
							<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
								{#each page.items as course, index (course.id)}
									{@const absIndex = page.start + index}
									{@const groupKey = deriveGroupKey(course)}
									{@const variants = getGroupEntries(groupKey)}
									{@const conflictDetails = getConflictDetails(course.id)}
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
										<CardBulkCheckbox
											slot="meta-controls"
											checked={bulkHas(bulkSelection, { kind: 'section', key: course.id })}
											ariaLabel={t('panels.selected.bulk.selectSection').replace('{name}', course.title)}
											on:toggle={() =>
												(bulkSelection = bulkToggle(bulkSelection, { kind: 'section', key: course.id }))}
										/>
										<CardActionBar slot="actions" class={variantActionsClass}>
											{#if !autoSolveEnabled}
												<AppButton variant="secondary" size="sm" on:click={() => dropSelected(course.id)}>
													{t('panels.selected.drop')}
												</AppButton>
												{#if variants.length > 1}
													<AppButton
														variant="secondary"
														size="sm"
														on:click={() => openReselectDialog(groupKey, course.id)}
													>
														{t('panels.selected.reselect')}
													</AppButton>
												{/if}
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

		{#if reselectDialogOpen && reselectDialogGroupKey}
			{@const dialogVariants = getGroupEntries(reselectDialogGroupKey)}
			{@const selectedId = reselectDialogEntryId ?? reselectDialogCurrentId ?? dialogVariants[0]?.id ?? ''}
			<AppDialog open={true} title={t('dialogs.groupPick.title')} on:close={closeReselectDialog}>
				<p class="m-0 text-[var(--app-color-fg-muted)]">{t('dialogs.groupPick.hint')}</p>
				<div class="flex flex-col gap-2">
					{#each dialogVariants as variant (variant.id)}
						<label class="flex items-start gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
							<input
								type="radio"
								name="selected-group-reselect"
								value={variant.id}
								checked={selectedId === variant.id}
								disabled={variant.id === reselectDialogCurrentId}
								on:change={() => (reselectDialogEntryId = variant.id)}
							/>
							<span class="flex min-w-0 flex-1 flex-col gap-1">
								<span class="text-[var(--app-text-sm)] font-medium break-words [overflow-wrap:anywhere]">
									{variant.title || variant.id}
								</span>
								<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)] break-words [overflow-wrap:anywhere]">
									{variant.slot ?? ''} · {variant.teacher ?? ''} · {variant.location ?? ''}
								</span>
							</span>
						</label>
					{/each}
				</div>
				<svelte:fragment slot="actions">
					<AppButton variant="secondary" size="sm" on:click={closeReselectDialog}>
						{t('dialogs.groupPick.cancel')}
					</AppButton>
					<AppButton variant="primary" size="sm" on:click={confirmReselectDialog}>
						{t('dialogs.groupPick.confirm')}
					</AppButton>
				</svelte:fragment>
			</AppDialog>
		{/if}
	</ListSurface>
</DockPanelShell>

<AutoSolveSettingsDialog open={autoSolveDialogOpen} onClose={() => (autoSolveDialogOpen = false)} />
