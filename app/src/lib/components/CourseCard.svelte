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
		};
</script>

<script lang="ts">
	import { colorFromHash, adjustHslColor } from '$lib/utils/color';
	import { translator } from '$lib/i18n';
	import { hoveredCourse } from '$lib/stores/courseHover';
import { formatConflictLabel } from '$lib/utils/diagnosticLabels';
import { browser } from '$app/environment';

	export let id: string;
	export let title: string;
	export let teacher: string | null = null;
	export let teacherId: string | undefined = undefined;
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
	$: showRing = !collapsed;
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

	let titleElement: HTMLDivElement | null = null;
	let truncatedTitleTooltip: string | null = null;

	$: {
		if (browser && titleElement) {
			const overflowX = titleElement.scrollWidth - titleElement.clientWidth > 1;
			const overflowY = titleElement.scrollHeight - titleElement.clientHeight > 1;
			truncatedTitleTooltip = overflowX || overflowY ? title : null;
		} else if (!titleElement) {
			truncatedTitleTooltip = null;
		}
	}
</script>

<article
	class={`course-card ${collapsed ? 'collapsed' : ''} ${hoverable ? 'hoverable' : ''} ${isHighlighted ? 'highlighted' : ''}`}
	on:mouseenter={onHover}
	on:mouseleave={onLeave}
	on:focus={onHover}
	on:blur={onLeave}
	data-id={id}
	data-status={status ?? undefined}
	aria-label={`${title} - ${(teacher ?? teacherId) ?? ''} - ${time}`}
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
		<slot name="meta-controls" />
	</div>
	<div class="card-body">
		<div class="column title-col">
			<div class="title-row">
				<div class="title-main">
					<div
						class="title"
						bind:this={titleElement}
						title={truncatedTitleTooltip ?? undefined}
						aria-label={truncatedTitleTooltip ?? undefined}
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
		</div>
		{#if showTime}
			<div class="column time-col">
				<div class="label">{t('courseCard.timeLabel')}</div>
				<div class="value">{time || t('courseCard.noTime')}</div>
			</div>
		{/if}
		<div class="column info-col">
			<div class="info-grid">
				<div>
					<div class="label">{t('courseCard.courseCodeLabel')}</div>
					<div class="value info-block">
						{#if courseCode}
							<span class="info-primary">{courseCode}</span>
						{:else}
							<span class="info-muted">{t('courseCard.courseCodePending')}</span>
						{/if}
					</div>
				</div>
				<div>
					<div class="label">{t('courseCard.creditLabel')}</div>
					<div class="value info-block">
						{#if typeof credit === 'number'}
							<span>{t('courseCard.creditValue').replace('{value}', credit.toString())}</span>
						{:else}
							<span class="info-muted">{t('courseCard.creditPending')}</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="actions">
			<slot name="actions" />
		</div>
	</div>
</article>
<style>
	.course-card {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: var(--app-space-4);
		padding: var(--app-space-4) var(--app-space-5);
		border-radius: var(--app-radius-lg);
		border: 1px solid var(--app-color-border-subtle);
		background: var(--app-color-bg);
		min-width: 0;
		color: var(--app-color-fg);
		transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
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
		gap: var(--app-space-3);
		flex: 0 0 auto;
		min-width: 72px;
	}

	.capacity-col {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.ring {
		position: relative;
		width: 60px;
		height: 60px;
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
		gap: var(--app-space-4);
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: var(--app-space-2);
		flex: 1 1 clamp(12rem, 30%, 20rem);
		min-width: min(12rem, 100%);
		min-height: 0;
	}

	.title-col {
		flex: 2 1 clamp(16rem, 45%, 28rem);
		min-width: min(14rem, 100%);
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		gap: var(--app-space-3);
		flex-wrap: wrap;
		min-width: 0;
	}

	.title-main {
		display: flex;
		align-items: flex-start;
		gap: var(--app-space-2);
		flex: 1 1 auto;
		min-width: 0;
	}

	.title {
		font-size: var(--app-text-lg);
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
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

	.info-col .info-campus {
		color: color-mix(in srgb, var(--app-color-fg) 70%, transparent);
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--app-space-3);
	}

	.info-block {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--app-space-2);
		min-height: 0;
	}

	.info-muted {
		color: color-mix(in srgb, var(--app-color-fg) 45%, transparent);
	}

	.info-col .divider {
		color: color-mix(in srgb, var(--app-color-fg) 20%, transparent);
	}

	.actions {
		display: flex;
		flex: 0 0 auto;
		min-width: 0;
		justify-content: flex-end;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--app-space-2);
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

	@container panel-shell (max-width: 720px) {
		.course-card {
			flex-wrap: wrap;
			padding: var(--app-space-4);
		}

		.card-body {
			width: 100%;
		}

		.actions {
			width: 100%;
		}
	}

	@container panel-shell (max-width: 560px) {
		.column,
		.actions {
			flex-basis: 100%;
			min-width: 100%;
		}

		.actions {
			justify-content: flex-start;
		}
	}

	@container panel-shell (max-width: 420px) {
		.course-card {
			gap: var(--app-space-3);
			padding: var(--app-space-3);
		}

		.title {
			font-size: var(--app-text-md);
		}
	}

	@container panel-shell (max-width: 360px) {
		.meta-column {
			flex-direction: column;
			align-items: flex-start;
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
	}

	@supports not (container-type: inline-size) {
		@media (max-width: 640px) {
			.column,
			.actions {
				flex-basis: 100%;
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
