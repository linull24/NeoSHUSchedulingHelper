<script lang="ts">
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import HoverInfoBar from '$lib/components/HoverInfoBar.svelte';
	import { translator } from '$lib/i18n';
	import '$lib/styles/panels/course-calendar-panel.scss';
	import {
		weekdays,
		periods,
		tableStyle,
		visibleEntries,
		activeId,
		shouldShowLabel,
		getSpanClass,
		getParityClass,
		buildBlockStyle,
		getClipPath,
		handleCellHover,
		handleCellLeave,
		handleEntryHover,
		handleEntryLeave
	} from './CourseCalendarPanel.state';

	let t = (key: string) => key;
	$: t = $translator;
</script>

<DockPanelShell>
	<ListSurface
		title={t('calendar.title')}
		subtitle={t('calendar.description')}
		enableStickyToggle={false}
		density="comfortable"
	>
		<div class="calendar-surface">
			<div class="calendar-table" style={$tableStyle} aria-label={t('calendar.title')}>
		<div class="corner"></div>
		{#each $weekdays as dayLabel, dayIndex}
			<div class="table-header" style={`grid-column:${dayIndex + 2};`}>{dayLabel}</div>
		{/each}

		{#each periods as period, rowIndex}
			<div class="time-cell" style={`grid-row:${rowIndex + 2};`}>
				<strong>{(period as any).label ?? `${t('calendar.slotPrefix')}${rowIndex + 1}${t('calendar.slotSuffix')}`}</strong>
				<span>{period.start ?? '??'} - {period.end ?? '??'}</span>
			</div>
			{#each $weekdays as _, dayIndex}
				<div
					role="button"
					class="table-cell"
					style={`grid-row:${rowIndex + 2}; grid-column:${dayIndex + 2};`}
					on:mouseenter={() => handleCellHover(dayIndex, rowIndex)}
					on:mouseleave={handleCellLeave}
					tabindex="0"
				></div>
			{/each}
		{/each}

		{#each $visibleEntries as entry, index (entry.key)}
			{@const hasClipPath = getClipPath(entry) !== 'none'}
			{@const isHighlighted = $activeId === entry.id}
			{@const showLabel = shouldShowLabel(entry)}
			{@const blockClass = [
				'course-block',
				showLabel ? 'labelled' : 'compact',
				isHighlighted ? 'active highlighted' : '',
				getSpanClass(entry),
				getParityClass(entry),
				hasClipPath ? 'with-clip' : '',
				entry.ghost ? 'ghost' : ''
			]
				.filter(Boolean)
				.join(' ')}
			<button
				type="button"
				class={blockClass}
				style={buildBlockStyle(entry)}
				on:mouseenter={() => handleEntryHover(entry)}
				on:focus={() => handleEntryHover(entry)}
				on:mouseleave={handleEntryLeave}
				on:blur={handleEntryLeave}
				aria-label={`${entry.title} ${entry.location}`}
			>
				{#if showLabel}
					<div class="course-text">
						<strong>{entry.title}</strong>
						<small>{entry.location}</small>
					</div>
				{:else if hasClipPath}
					<div class="course-indicator" aria-hidden="true">
						{String.fromCharCode(9312 + (index % 20))}
					</div>
				{/if}
			</button>
		{/each}
	</div>

	<HoverInfoBar />
		</div>
	</ListSurface>
</DockPanelShell>
