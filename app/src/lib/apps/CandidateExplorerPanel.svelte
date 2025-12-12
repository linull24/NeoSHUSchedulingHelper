<svelte:options runes={false} />

<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import PaginationFooter from '$lib/components/PaginationFooter.svelte';
	import { translator } from '$lib/i18n';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { crossCampusAllowed } from '$lib/stores/coursePreferences';
	import { paginationMode, pageSize, pageNeighbors } from '$lib/stores/paginationSettings';
	import { groupCoursesByName } from '$lib/utils/courseHelpers';
	import { courseCatalogMap } from '$lib/data/catalog/courseCatalog';
	import {
		collapseByName,
		filteredCourses,
		expandedCourse,
		expandedGroups,
		filters,
		filterMeta,
		handleHover,
		handleLeave,
		toggleVariantList,
		toggleGroup,
		selectFromWishlist,
		removeCourse,
		removeAll,
		removeGroup,
		getVariantList,
		reselectFromWishlist,
		selectedSet
	} from './CandidateExplorerPanel.state';

	let currentPage = 1;
	let loadedCount = 0;
	let lastMode: 'paged' | 'continuous' | null = null;
	let contentSignature = '';
	let showPaginationFooter = false;

	let t = (key: string) => key;
	$: t = $translator;

	const clearButtonClass =
		'inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] px-3 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-danger)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--app-color-bg)_94%,#000)] disabled:opacity-50 disabled:pointer-events-none';
	const groupHeaderClass =
		'flex w-full items-center justify-between px-4 py-3 text-left text-[var(--app-color-fg)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]';
	const groupToolbarClass =
		'flex items-center justify-between border-t border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] px-4 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]';
	const actionButtonBase =
		'inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--app-color-bg)_94%,#000)]';
	const actionButtonPositive = `${actionButtonBase} border-[color:var(--app-color-primary)] text-[var(--app-color-primary)]`;
	const actionButtonDanger = `${actionButtonBase} border-[color:var(--app-color-danger)] text-[var(--app-color-danger)]`;
	const variantActionsClass =
		'mt-3 flex flex-wrap items-center gap-2 rounded-[var(--app-radius-md)] bg-[var(--app-color-bg-muted)] px-3 py-2 text-[var(--app-text-sm)]';
	const variantsMenuClass =
		'mt-3 flex flex-col gap-1 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-3';
	const variantMenuButtonClass =
		'flex flex-col rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] px-3 py-2 text-left text-[var(--app-text-sm)] text-[var(--app-color-fg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_94%,#000)]';
	const conflictNoteClass = 'text-[var(--app-text-xs)] text-[var(--app-color-danger)]';
	const scrollContainerClass =
		'h-full min-h-[240px] overflow-auto rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]';

	$: pageSizeValue = Math.max(1, $pageSize || 1);
	$: totalItems = $filteredCourses.length;
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
			? $filteredCourses.slice((currentPage - 1) * pageSizeValue, currentPage * pageSizeValue)
			: $filteredCourses.slice(0, Math.min(totalItems, loadedCount));

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

	const formatGroupTotal = (count: number) =>
		t('panels.candidates.groupTotal').replace('{count}', String(count));

	function describeConflict(courseId: string) {
		const meta = $filterMeta.get(courseId);
		if (!meta || meta.conflict === 'none') return null;
		const conflictDivider = t('panels.common.conflictDivider');
		if (meta.diagnostics.length) {
			return meta.diagnostics
				.map((d) => (d.reason ? `${d.label}${conflictDivider}${d.reason}` : d.label))
				.join(t('panels.common.conflictListSeparator'));
		}
		const targetNames = meta.conflictTargets
			.map((id) => courseCatalogMap.get(id)?.title ?? id)
			.join(t('panels.common.conflictNameSeparator'));
		const prefix =
			meta.conflict === 'hard-conflict'
				? t('panels.common.conflictHard')
				: t('panels.common.conflictTime');
		return targetNames ? `${prefix}${conflictDivider}${targetNames}` : prefix;
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.candidates.title')}
		subtitle={t('panels.candidates.description')}
		count={totalItems}
		density="comfortable"
		enableStickyToggle={true}
		bodyScrollable={false}
	>
		<svelte:fragment slot="header-actions">
			<button type="button" class={clearButtonClass} on:click={removeAll} disabled={$filteredCourses.length === 0}>
				{t('panels.candidates.clear')}
			</button>
		</svelte:fragment>

		<svelte:fragment slot="filters">
			<CourseFiltersToolbar {filters} options={filterOptions} mode="wishlist" />
		</svelte:fragment>

		<div class={scrollContainerClass} on:scroll={handleScroll}>
			{#if $collapseByName}
				{#if grouped.length === 0}
					<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
						{t('panels.candidates.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each grouped as [groupKey, groupCourses], groupIndex (groupKey)}
							{@const primary = groupCourses[0]}
							{@const expanded = $expandedGroups.has(groupKey)}
							<article class={`flex flex-col ${expanded ? 'bg-[var(--app-color-bg-muted)]' : 'bg-transparent'}`}>
								<button type="button" class={groupHeaderClass} on:click={() => toggleGroup(groupKey)}>
									<div class="flex flex-col gap-1">
										<strong class="text-[var(--app-text-md)] font-semibold">{groupKey}</strong>
										<small class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
											{primary?.slot ?? t('courseCard.noTime')} · {formatVariantCount(groupCourses.length)}
										</small>
									</div>
									<span aria-hidden="true" class="text-[var(--app-color-fg-muted)]">
										{expanded ? '▴' : '▾'}
									</span>
								</button>
								<div class={groupToolbarClass}>
									<span>{formatGroupTotal(groupCourses.length)}</span>
									<button type="button" class={actionButtonDanger} on:click={() => removeGroup(groupCourses)}>
										{t('panels.candidates.removeGroup')}
									</button>
								</div>
								{#if expanded}
									<div class="flex flex-col gap-3 border-t border-[color:var(--app-color-border-subtle)] px-3 pb-4">
										{#each groupCourses as course, variantIndex (course.id)}
											{@const conflict = describeConflict(course.id)}
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
											>
												<div slot="actions" class={variantActionsClass}>
													{#if $selectedSet?.has(course.id)}
														<button type="button" class={actionButtonBase} on:click={() => reselectFromWishlist(course.id)}>
															{t('panels.selected.reselect')}
														</button>
													{:else}
														<button type="button" class={actionButtonPositive} on:click={() => selectFromWishlist(course.id)}>
															{t('panels.candidates.select')}
														</button>
														<button type="button" class={actionButtonBase} on:click={() => removeCourse(course.id)}>
															{t('panels.candidates.removeGroup')}
														</button>
													{/if}
													{#if conflict}
														<span class={conflictNoteClass} title={conflict}>{conflict}</span>
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
						{t('panels.candidates.empty')}
					</p>
				{:else}
					<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
						{#each visibleCourses as course, index (course.id)}
							{@const conflict = describeConflict(course.id)}
							<article class="flex flex-col gap-2 px-3 py-3">
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
								>
									<div slot="actions" class={variantActionsClass}>
										{#if $selectedSet?.has(course.id)}
											<button type="button" class={actionButtonBase} on:click={() => reselectFromWishlist(course.id)}>
												{t('panels.selected.reselect')}
											</button>
										{:else}
											<button type="button" class={actionButtonPositive} on:click={() => selectFromWishlist(course.id)}>
												{t('panels.candidates.select')}
											</button>
											<button type="button" class={actionButtonBase} on:click={() => removeCourse(course.id)}>
												{t('panels.candidates.removeGroup')}
											</button>
										{/if}
										{#if getVariantList(course.id).length > 1}
											<button
												type="button"
												class={`${actionButtonBase} ${$expandedCourse === course.id ? 'bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]' : ''}`}
												on:click={() => toggleVariantList(course.id)}
											>
												{$expandedCourse === course.id
													? t('panels.candidates.toggleMore.collapse')
													: t('panels.candidates.toggleMore.expand')}
											</button>
										{/if}
										{#if conflict}
											<span class={conflictNoteClass} title={conflict}>{conflict}</span>
										{/if}
									</div>
								</CourseCard>
								{#if $expandedCourse === course.id}
									<div class={variantsMenuClass}>
										{#each getVariantList(course.id) as variant (variant.id)}
											<button type="button" class={variantMenuButtonClass} on:click={() => selectFromWishlist(variant.id)}>
												<span class="text-[var(--app-text-sm)] font-medium">{variant.slot}</span>
												<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{variant.teacher} · {variant.location}
												</small>
											</button>
										{/each}
									</div>
								{/if}
							</article>
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
