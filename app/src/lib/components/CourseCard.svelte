<svelte:options runes={false} />

<script context="module" lang="ts">
	export type CapacityState = 'healthy' | 'warning' | 'critical' | 'empty';
	import type { Actionable, Collapsible, Hoverable, MetaDisplay } from '$lib/ui/traits';

		export type CourseCardContract = Hoverable &
			Collapsible &
			MetaDisplay &
			Actionable & {
				id: string;
				title: string;
				time: string;
				courseCode?: string;
				credit?: number | null;
				showTime?: boolean;
				density?: 'normal' | 'dense';
			};
</script>

<script lang="ts">
	import { colorFromHash, adjustHslColor } from '$lib/utils/color';
	import { translator } from '$lib/i18n';
	import { hoveredCourse } from '$lib/stores/courseHover';
	import { formatConflictLabel } from '$lib/utils/diagnosticLabels';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { crossCampusAllowed } from '$lib/stores/coursePreferences';
	import { courseCatalogMap } from '$lib/data/catalog/courseCatalog';

	export let id: string;
	export let title: string;
	export let teacher: string | null = null;
	export let time: string;
	export let courseCode: string | undefined = undefined;
	export let credit: number | null = null;
	export let showTime = true;
	export let capacity = 0;
	export let vacancy = 0;
	export let collapsed = false;
	export let colorSeed: string;
	export let specialTags: string[] = [];
	export let status: 'limited' | 'full' | undefined = undefined;
	export let hoverable = true;
	export let onHover: (() => void) | undefined;
	export let onLeave: (() => void) | undefined;
	export let toneIndex = 0;
	export let density: 'normal' | 'dense' = 'normal';
		export let selectable = false;
		export let selectState: 'include' | 'exclude' | null = null;
		export let onToggleSelect: (() => void) | undefined = undefined;
		export let showConflictBadge: boolean | undefined = undefined;
		export let conflictDetails: Array<{ label: string; value?: string }> | null = null;

	// Bidirectional hover highlighting - P2-8b
	$: isHighlighted = $hoveredCourse?.id === id && $hoveredCourse?.source !== 'list';

	const CAPACITY_THRESHOLDS = {
		warningOccupancy: 0.75,
		criticalOccupancy: 0.8,
		warningRemaining: 10,
		criticalRemaining: 5
	} as const;

	const RING_COLORS: Record<CapacityState, string> = {
		healthy: 'var(--app-color-ring-healthy)',
		warning: 'var(--app-color-ring-warning)',
		critical: 'var(--app-color-ring-critical)',
		empty: 'var(--app-color-ring-empty)'
	};

	$: remaining = Math.max(vacancy, 0);
	$: occupancy = capacity > 0 ? Math.min(1, (capacity - remaining) / capacity) : 1;
	$: overflow = vacancy < 0;
	$: ringState = computeCapacityState({ occupancy, remaining, overflow });
	$: ringColorToken = RING_COLORS[ringState];
	$: showRing = !collapsed && capacity > 0;
	$: baseColor = colorFromHash(colorSeed, { saturation: 60, lightness: 55 });
	$: markerColor = adjustForContrast(baseColor, toneIndex);

	function computeCapacityState({
		occupancy,
		remaining,
		overflow
	}: {
		occupancy: number;
		remaining: number;
		overflow: boolean;
	}): CapacityState {
		if (remaining <= 0 || overflow) return 'empty';
		if (
			occupancy >= CAPACITY_THRESHOLDS.criticalOccupancy ||
			remaining <= CAPACITY_THRESHOLDS.criticalRemaining
		) {
			return 'critical';
		}
		if (
			occupancy >= CAPACITY_THRESHOLDS.warningOccupancy ||
			remaining <= CAPACITY_THRESHOLDS.warningRemaining
		) {
			return 'warning';
		}
		return 'healthy';
	}

	function adjustForContrast(color: string, index: number) {
		// Alternate lightness to reduce adjacency clashes.
		const delta = index % 2 === 0 ? 0 : index % 4 === 1 ? -8 : 8;
		return adjustHslColor(color, { lightnessDelta: delta });
	}

	let t = (key: string) => key;
	$: t = $translator;
	$: includeLabel = t('courseCard.includeShort');
	$: excludeLabel = t('courseCard.excludeShort');
	$: noneLabel = t('courseCard.noneShort');
	$: conflictLabel = t('courseCard.conflict');
	$: timeValue = time || t('courseCard.noTime');
	$: courseCodeValue = courseCode ?? t('courseCard.courseCodePending');
	$: creditValue = typeof credit === 'number' ? credit.toString() : t('courseCard.creditPending');
	$: teacherValue = teacher?.trim() ?? '';
		$: teacherLabel = t('courseCard.teacherLabel');
		$: campusLabel = t('courseCard.campusLabel');
		$: campusValue = courseCatalogMap.get(id)?.campus ?? '';

		// PERF: Avoid measuring title overflow (scrollWidth/clientWidth) for every card render.
		// Always expose the full title as tooltip — cheap and predictable.
		$: titleTooltip = title;

		let kvGridElement: HTMLDivElement | null = null;
		let ro: ResizeObserver | null = null;
		let roTimer: ReturnType<typeof setTimeout> | null = null;
		let kvWantsPills = false;
	let usePills = false;

	$: usePills = density === 'dense' || kvWantsPills;

		function recomputeKvLayout() {
			if (!kvGridElement) return;
			const items = Array.from(kvGridElement.querySelectorAll<HTMLElement>('.kv'));
			if (!items.length) {
			kvWantsPills = false;
			return;
		}
		const rowTops = new Set<number>();
		for (const el of items) {
			rowTops.add(Math.round(el.offsetTop));
		}
		kvWantsPills = rowTops.size > 2;
	}

	onMount(() => {
		if (!browser) return;
		if (!kvGridElement) return;
		if (density === 'dense') return;

		ro = new ResizeObserver(() => {
			if (roTimer) clearTimeout(roTimer);
			roTimer = setTimeout(recomputeKvLayout, 60);
		});
		ro.observe(kvGridElement);

		requestAnimationFrame(recomputeKvLayout);
		return () => {
			ro?.disconnect();
			ro = null;
			if (roTimer) clearTimeout(roTimer);
			roTimer = null;
		};
	});
</script>

	<article
		class={`course-card density-${density} ${usePills ? 'use-pills' : ''} ${collapsed ? 'collapsed' : ''} ${hoverable ? 'hoverable' : ''} ${isHighlighted ? 'highlighted' : ''}`}
	on:mouseenter={onHover}
	on:mouseleave={onLeave}
	on:focus={onHover}
	on:blur={onLeave}
		data-id={id}
		data-status={status ?? undefined}
		aria-label={`${title}${teacherValue ? ` - ${teacherValue}` : ''} - ${timeValue}`}
	>
	<div class="color-marker" style={`background:${markerColor};`}></div>
	<div class="meta-column">
		{#if showRing}
			<div class="capacity-col">
				<div class="ring" style={`--ring-color:${ringColorToken};`}>
					<svg viewBox="0 0 36 36">
						<path
							class="track"
							d="M18 2.0845
							a 15.9155 15.9155 0 0 1 0 31.831
							a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
						<path
							class="progress"
							d="M18 2.0845
							a 15.9155 15.9155 0 0 1 0 31.831
							a 15.9155 15.9155 0 0 1 0 -31.831"
							style={`stroke-dasharray:${Math.min(100, occupancy * 100)} 100;`}
					/>
				</svg>
				<div class="ring-text">{remaining}</div>
			</div>
			</div>
		{/if}
		{#if selectable}
			<button
				type="button"
				class={`intent-toggle ${selectState ?? 'neutral'}`}
				on:click={onToggleSelect}
				aria-label={t('courseCard.markSelection')}
			>
				{selectState === 'include' ? includeLabel : selectState === 'exclude' ? excludeLabel : noneLabel}
			</button>
		{/if}
		{#if $$slots['meta-controls']}
			<div class="meta-controls-slot">
				<slot name="meta-controls" />
			</div>
		{/if}
		</div>
	<div class="card-body">
		<div class="column title-col">
			<div class="title-row">
					<div class="title-main">
						<div
							class="title"
							title={titleTooltip}
							aria-label={titleTooltip}
						>
							{title}
						</div>
					{#if showConflictBadge}
						<button type="button" class="conflict-indicator" aria-label={conflictLabel}>
							<span aria-hidden="true">!</span>
							{#if conflictDetails && conflictDetails.length}
								<div class="conflict-popover">
									<ul>
										{#each conflictDetails as detail, idx (idx)}
											{@const localizedLabel = formatConflictLabel(detail.label, t)}
											<li>{localizedLabel}{detail.value ? `：${detail.value}` : ''}</li>
										{/each}
									</ul>
								</div>
							{:else}
								<div class="conflict-popover empty">{t('courseCard.conflictNone')}</div>
							{/if}
						</button>
					{/if}
				</div>
				{#if specialTags.length}
					<div class="tags">
						{#each specialTags as tag, idx (idx)}
							<span class="tag">{tag}</span>
						{/each}
					</div>
				{/if}
				<!-- UI-RECKON-1: Removed status badge per Rule6 - capacity ring is primary indicator -->
				<!-- {#if status}
					<span class={`status ${status}`}>
						{status === 'limited' ? t('courseCard.statusLimited') : t('courseCard.statusFull')}
					</span>
				{/if} -->
			</div>
			<div class="kv-grid" bind:this={kvGridElement} aria-hidden={usePills}>
				{#if showTime}
					<div class="kv" title={`${t('courseCard.timeLabel')}: ${timeValue}`}>
						<span class="kv-label">{t('courseCard.timeLabel')}</span>
						<span class="kv-value">{timeValue}</span>
					</div>
				{/if}
				{#if teacherValue}
					<div class="kv" title={`${teacherLabel}: ${teacherValue}`}>
						<span class="kv-label">{teacherLabel}</span>
						<span class="kv-value">{teacherValue}</span>
					</div>
				{/if}
				{#if $crossCampusAllowed && campusValue}
					<div class="kv" title={`${campusLabel}: ${campusValue}`}>
						<span class="kv-label">{campusLabel}</span>
						<span class="kv-value">{campusValue}</span>
					</div>
				{/if}
				<div class="kv" title={`${t('courseCard.courseCodeLabel')}: ${courseCodeValue}`}>
					<span class="kv-label">{t('courseCard.courseCodeLabel')}</span>
					<span class="kv-value">
						{#if courseCode}
							{courseCode}
						{:else}
							<span class="info-muted">{courseCodeValue}</span>
						{/if}
					</span>
				</div>
				<div class="kv" title={`${t('courseCard.creditLabel')}: ${creditValue}`}>
					<span class="kv-label">{t('courseCard.creditLabel')}</span>
					<span class="kv-value">
						{#if typeof credit === 'number'}
							{creditValue}
						{:else}
							<span class="info-muted">{creditValue}</span>
						{/if}
					</span>
				</div>
			</div>
			<div class="meta-line" aria-hidden={!usePills}>
				{#if showTime}
					<span class="meta-pill">{t('courseCard.timeLabel')}: {timeValue}</span>
				{/if}
				{#if teacherValue}
					<span class="meta-pill">{teacherLabel}: {teacherValue}</span>
				{/if}
				{#if $crossCampusAllowed && campusValue}
					<span class="meta-pill">{campusLabel}: {campusValue}</span>
				{/if}
				<span class="meta-pill">{t('courseCard.courseCodeLabel')}: {courseCodeValue}</span>
				<span class="meta-pill">{t('courseCard.creditLabel')}: {creditValue}</span>
			</div>
		</div>
			<div class="actions">
				<slot name="actions" />
			</div>
			{#if $$slots.default}
				<div class="default-slot">
					<slot />
				</div>
			{/if}
		</div>
	</article>
<style>
		.course-card {
			position: relative;
			--course-card-meta-column-min-normal: 72px;
			--course-card-ring-size-normal: 60px;
			--course-card-gap: var(--app-space-3);
			--course-card-pad-y: var(--app-space-3);
			--course-card-pad-x: var(--app-space-4);
			--meta-column-min: var(--course-card-meta-column-min-normal);
			--ring-size: var(--course-card-ring-size-normal);
			--course-card-title-lines: 2;
			--course-card-title-size: var(--app-text-lg);
			--course-card-kv-grid-max-h: 999px;
			--course-card-kv-grid-mt: var(--app-space-1);
			--course-card-meta-line-max-h: 0px;
			--course-card-meta-line-mt: 0px;
			--course-card-meta-line-row-gap: var(--app-space-1);
			--course-card-body-gap: var(--app-space-3);
			--course-card-actions-gap: var(--app-space-1);
			--course-card-title-row-gap: var(--app-space-2);
			--course-card-meta-pill-height: 1.5rem;
			display: flex;
			align-items: flex-start;
			gap: var(--course-card-gap);
			padding: var(--course-card-pad-y) var(--course-card-pad-x);
		border-radius: var(--app-radius-lg);
		border: 1px solid var(--app-color-border-subtle);
		background: var(--app-color-bg);
		min-width: 0;
		color: var(--app-color-fg);
		transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
	}

		.course-card.density-dense {
			--course-card-gap: var(--app-space-2);
			--course-card-pad-y: var(--app-space-2);
			--course-card-pad-x: var(--app-space-3);
			--meta-column-min: calc(var(--course-card-meta-column-min-normal) - var(--app-space-5));
			--ring-size: calc(var(--course-card-ring-size-normal) - var(--app-space-4));
			--course-card-title-lines: 1;
			--course-card-title-size: var(--app-text-md);
			--course-card-kv-grid-max-h: 0px;
			--course-card-kv-grid-mt: 0px;
			--course-card-meta-line-max-h: 999px;
			--course-card-meta-line-mt: 0px;
			--course-card-body-gap: var(--app-space-1);
			--course-card-actions-gap: var(--app-space-1);
			--course-card-title-row-gap: var(--app-space-2);
			--course-card-meta-pill-height: 1.35rem;
		}

	.course-card.density-dense .meta-column {
		gap: var(--app-space-2);
	}

	.course-card.density-dense .meta-controls-slot {
		left: calc(4px + var(--app-space-3));
		bottom: var(--app-space-2);
	}

		.course-card.density-dense .title-row {
			flex-wrap: nowrap;
			overflow: hidden;
		}

		.course-card.density-dense .title-main {
			overflow: hidden;
		}

		.course-card.density-dense .title-col {
			min-width: 0;
			flex: 1 1 auto;
		}

	.course-card.density-dense .title {
		font-size: var(--course-card-title-size);
		line-clamp: var(--course-card-title-lines);
		-webkit-line-clamp: var(--course-card-title-lines);
	}

	.course-card.density-dense .meta-pill {
		padding: 0 var(--app-space-1);
		font-size: var(--app-text-xs);
	}

	.course-card.density-dense .tags {
		display: none;
	}

	.course-card.use-pills {
		--course-card-kv-grid-max-h: 0px;
		--course-card-kv-grid-mt: 0px;
		--course-card-meta-line-max-h: 999px;
		--course-card-meta-line-mt: var(--app-space-1);
	}

	.course-card.hoverable:hover,
	.course-card.hoverable:focus-within {
		border-color: color-mix(in srgb, var(--app-color-primary) 55%, var(--app-color-border-subtle));
		box-shadow: 0 10px 28px color-mix(in srgb, var(--app-color-primary) 25%, transparent);
	}

	.color-marker {
		width: 4px;
		flex: 0 0 4px;
		border-radius: var(--app-radius-lg);
		align-self: stretch;
		background: color-mix(in srgb, var(--app-color-primary) 85%, transparent);
	}

		.meta-column {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--app-space-2);
			flex: 0 0 auto;
			min-width: var(--meta-column-min);
		}

	.meta-controls-slot {
		position: absolute;
		left: calc(4px + var(--app-space-4));
		bottom: var(--app-space-3);
		display: flex;
		align-items: center;
		gap: var(--app-space-2);
		pointer-events: none;
		z-index: 1;
	}

	.meta-controls-slot > :global(*) {
		pointer-events: auto;
	}

	.capacity-col {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.ring {
		position: relative;
		width: var(--ring-size);
		height: var(--ring-size);
		display: grid;
		place-items: center;
		border-radius: 50%;
	}

	.ring::after {
		content: '';
		position: absolute;
		inset: -6px;
		border-radius: inherit;
		border: 1px solid color-mix(in srgb, var(--ring-color) 65%, transparent);
		opacity: 0.6;
		animation: ring-pulse 2.4s ease-in-out infinite;
	}

	.ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring .track {
		fill: none;
		stroke: color-mix(in srgb, var(--app-color-fg) 20%, transparent);
		stroke-width: 4;
	}

	.ring .progress {
		fill: none;
		stroke: var(--ring-color);
		stroke-width: 4;
		stroke-linecap: round;
	}

	.ring-text {
		position: absolute;
		font-size: var(--app-text-sm);
		font-weight: 600;
		color: var(--app-color-fg);
		text-align: center;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		text-shadow: 0 0 6px color-mix(in srgb, var(--app-color-bg) 75%, transparent);
	}

	.intent-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: var(--app-radius-md);
		border: 1px solid var(--app-color-border-subtle);
		background: var(--app-color-bg-elevated);
		font-size: var(--app-text-xs);
		color: var(--app-color-fg);
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease;
	}

	.intent-toggle.include {
		background: color-mix(in srgb, var(--app-color-primary) 20%, transparent);
		color: var(--app-color-primary);
	}

	.intent-toggle.exclude {
		background: color-mix(in srgb, var(--app-color-danger) 18%, transparent);
		color: var(--app-color-danger);
	}

		.card-body {
			display: flex;
			flex: 1 1 auto;
			min-width: 0;
			flex-wrap: wrap;
			align-items: flex-start;
			gap: var(--course-card-body-gap);
		}

		.default-slot {
			display: none;
		}

		.column {
			display: flex;
			flex-direction: column;
			gap: var(--app-space-1);
			flex: 1 1 clamp(12rem, 30%, 20rem);
			min-width: min(10rem, 100%);
			min-height: 0;
		}

	.title-col {
		flex: 2 1 clamp(16rem, 45%, 28rem);
		min-width: min(12rem, 100%);
		gap: 0;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		gap: var(--course-card-title-row-gap);
		flex-wrap: wrap;
		min-width: 0;
	}

		.kv-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
			column-gap: clamp(var(--app-space-2), 2vw, var(--app-space-4));
			row-gap: var(--app-space-1);
			margin-top: var(--course-card-kv-grid-mt);
			max-height: var(--course-card-kv-grid-max-h);
			overflow: hidden;
			min-width: 0;
		}

		.kv {
			display: flex;
			align-items: baseline;
			gap: var(--app-space-1);
			min-width: 0;
			white-space: nowrap;
		}

		.kv-label {
			flex: 0 0 auto;
			font-size: var(--app-text-sm);
			color: var(--app-color-fg-muted);
		}

		.kv-value {
			flex: 1 1 auto;
			min-width: 0;
			font-size: var(--app-text-md);
			font-weight: 500;
			color: var(--app-color-fg);
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.meta-line {
			display: flex;
			align-items: flex-start;
			flex-wrap: wrap;
			column-gap: var(--app-space-2);
			row-gap: var(--course-card-meta-line-row-gap);
			min-width: 0;
			margin-top: var(--course-card-meta-line-mt);
			max-height: var(--course-card-meta-line-max-h);
			overflow: hidden;
		}

	.meta-pill {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		padding: 0 var(--app-space-2);
		min-height: var(--course-card-meta-pill-height);
		border-radius: 999px;
		border: 1px solid var(--app-color-border-subtle);
		background: var(--app-color-bg-elevated);
		font-size: var(--app-text-sm);
		color: color-mix(in srgb, var(--app-color-fg) 90%, transparent);
		white-space: normal;
		word-break: break-word;
	}

	.title-main {
		display: flex;
		align-items: flex-start;
		gap: var(--app-space-2);
		flex: 1 1 auto;
		min-width: 0;
	}

	.title {
		font-size: var(--course-card-title-size);
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		line-clamp: var(--course-card-title-lines);
		-webkit-line-clamp: var(--course-card-title-lines);
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: auto-phrase;
		overflow-wrap: break-word;
		white-space: normal;
	}

		.label {
			font-size: var(--app-text-sm);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		color: var(--app-color-fg-muted);
	}

	.value {
		font-size: var(--app-text-md);
		font-weight: 500;
		word-break: break-word;
		overflow-wrap: anywhere;
		color: var(--app-color-fg);
	}

		.info-block {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: var(--app-space-1);
			min-height: 0;
		}

		.info-block .info-primary,
		.info-block .info-muted {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

	.info-muted {
		color: color-mix(in srgb, var(--app-color-fg) 45%, transparent);
	}

	.actions {
		display: flex;
		flex: 0 0 auto;
		min-width: 0;
		justify-content: flex-end;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--course-card-actions-gap);
		margin-left: auto;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--app-space-2);
	}

	.tag {
		display: inline-flex;
		align-items: center;
		padding: var(--app-space-1) var(--app-space-2);
		border-radius: var(--app-radius-sm);
		background: color-mix(in srgb, var(--app-color-primary) 12%, transparent);
		color: var(--app-color-primary);
		font-size: var(--app-text-sm);
		font-weight: 500;
	}

	.conflict-indicator {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		border: none;
		background: color-mix(in srgb, var(--app-color-danger) 22%, transparent);
		color: var(--app-color-danger);
		font-weight: 700;
		cursor: help;
		padding: 0;
	}

	.conflict-indicator:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--app-color-danger) 55%, transparent);
		outline-offset: 2px;
	}

	.conflict-popover {
		position: absolute;
		top: calc(100% + var(--app-space-2));
		right: 0;
		min-width: min(240px, 70vw);
		padding: var(--app-space-3);
		border-radius: var(--app-radius-md);
		border: 1px solid var(--app-color-border-subtle);
		background: var(--app-color-bg-elevated);
		box-shadow: 0 10px 30px color-mix(in srgb, var(--app-color-bg) 60%, black);
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
		z-index: 40;
	}

	.conflict-popover ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--app-space-2);
		font-size: var(--app-text-sm);
	}

	.conflict-indicator:hover .conflict-popover,
	.conflict-indicator:focus-within .conflict-popover {
		opacity: 1;
		pointer-events: auto;
	}

	.actions :global(*) {
		min-width: 0;
	}

	.course-card.highlighted {
		outline: 2px solid var(--app-color-primary);
		outline-offset: 2px;
		z-index: 10;
		box-shadow: 0 12px 32px color-mix(in srgb, var(--app-color-primary) 35%, transparent);
		transform: translateY(-2px);
	}

	@container panel-shell (max-width: 960px) {
		.card-body {
			gap: var(--app-space-3);
		}

		.actions {
			justify-content: flex-start;
		}
	}

		@container panel-shell (max-width: 520px) {
			.course-card {
				--meta-column-min: calc(var(--course-card-meta-column-min-normal) - var(--app-space-3));
				--ring-size: calc(var(--course-card-ring-size-normal) - var(--app-space-2));
				--course-card-title-lines: 1;
				--course-card-title-size: var(--app-text-md);
			}
		}

	@container panel-shell (max-width: 420px) {
		.course-card {
			--course-card-gap: var(--app-space-3);
			--course-card-pad-y: var(--app-space-3);
			--course-card-pad-x: var(--app-space-3);
			--meta-column-min: calc(var(--course-card-meta-column-min-normal) - var(--app-space-5));
			--ring-size: calc(var(--course-card-ring-size-normal) - var(--app-space-4));
			--course-card-title-lines: 1;
			--course-card-title-size: var(--app-text-md);
		}
	}

	@container panel-shell (max-width: 360px) {
		.course-card {
			--course-card-meta-pill-height: 1.45rem;
		}

		.meta-column {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--app-space-2);
		}

		.capacity-col .ring {
			width: auto;
			height: auto;
			padding: var(--app-space-1) var(--app-space-2);
			border: 1px solid color-mix(in srgb, var(--ring-color) 35%, transparent);
			border-radius: var(--app-radius-md);
		}

		.capacity-col .ring::after,
		.capacity-col .ring svg {
			display: none;
		}

		.ring-text {
			position: static;
			text-shadow: none;
		}

		.meta-pill {
			padding: 0 var(--app-space-1);
			font-size: var(--app-text-xs);
		}
	}

	@supports not (container-type: inline-size) {
		@media (max-width: 520px) {
			.course-card {
				--meta-column-min: 60px;
				--ring-size: 52px;
				--course-card-title-lines: 1;
				--course-card-title-size: var(--app-text-md);
			}
		}

		@media (max-width: 420px) {
			.course-card {
				--course-card-gap: var(--app-space-3);
				--course-card-pad-y: var(--app-space-3);
				--course-card-pad-x: var(--app-space-3);
				--meta-column-min: 52px;
				--ring-size: 44px;
			}

			.title {
				font-size: var(--app-text-md);
				line-clamp: 1;
				-webkit-line-clamp: 1;
			}
		}

		@media (max-width: 360px) {
			.course-card {
				--course-card-meta-pill-height: 1.45rem;
			}

			.meta-column {
				flex-direction: column;
				align-items: flex-start;
				gap: var(--app-space-2);
			}

			.capacity-col .ring {
				width: auto;
				height: auto;
				padding: var(--app-space-1) var(--app-space-2);
				border: 1px solid color-mix(in srgb, var(--ring-color) 35%, transparent);
				border-radius: var(--app-radius-md);
			}

			.capacity-col .ring::after,
			.capacity-col .ring svg {
				display: none;
			}

			.ring-text {
				position: static;
				text-shadow: none;
			}

			.meta-pill {
				padding: 0 var(--app-space-1);
				font-size: var(--app-text-xs);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ring::after {
			animation: none;
			opacity: 0.2;
		}
	}

	@keyframes ring-pulse {
		0% {
			opacity: 0.2;
			transform: scale(0.95);
		}

		50% {
			opacity: 0.5;
			transform: scale(1.05);
		}

		100% {
			opacity: 0.2;
			transform: scale(0.95);
		}
	}
</style>
