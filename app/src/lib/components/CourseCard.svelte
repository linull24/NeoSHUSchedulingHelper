<script context="module" lang="ts">
	export type CapacityState = 'green' | 'yellow' | 'orange' | 'red';
</script>

<script lang="ts">
	import { colorFromHash, adjustHslColor } from '$lib/utils/color';
	import { translator } from '$lib/i18n';
	import { hoveredCourse } from '$lib/stores/courseHover';
	import { browser } from '$app/environment';
	import '$lib/styles/components/course-card.scss';

	export let id: string;
	export let title: string;
	export let teacher: string;
	export let teacherId: string | undefined = undefined;
	export let time: string;
	export let campus: string;
	export let crossCampusEnabled = false;
	export let capacity = 0;
	export let vacancy = 0;
	export let collapsed = false;
	export let colorSeed: string;
	export let specialInfo: string | undefined = undefined;
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
		yellowOccupancy: 0.75,
		orangeOccupancy: 0.8,
		yellowRemaining: 10,
		orangeRemaining: 5
	};

	$: remaining = Math.max(vacancy, 0);
	$: occupancy = capacity > 0 ? Math.min(1, (capacity - remaining) / capacity) : 1;
	$: overflow = vacancy < 0;
	$: ringState = computeCapacityState({ occupancy, remaining, overflow });
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
		if (remaining <= 0 || overflow) return 'red';
		if (occupancy >= CAPACITY_THRESHOLDS.orangeOccupancy || remaining <= CAPACITY_THRESHOLDS.orangeRemaining) {
			return 'orange';
		}
		if (occupancy >= CAPACITY_THRESHOLDS.yellowOccupancy || remaining <= CAPACITY_THRESHOLDS.yellowRemaining) {
			return 'yellow';
		}
		return 'green';
	}

	function adjustForContrast(color: string, index: number) {
		// Alternate lightness to reduce adjacency clashes.
		const delta = index % 2 === 0 ? 0 : index % 4 === 1 ? -8 : 8;
		return adjustHslColor(color, { lightnessDelta: delta });
	}

	function ringStyle(state: CapacityState) {
		switch (state) {
			case 'green':
				return '#22c55e';
			case 'yellow':
				return '#facc15';
			case 'orange':
				return '#f97316';
			case 'red':
			default:
				return '#ef4444';
		}
	}

	let t = (key: string) => key;
	$: t = $translator;
	$: includeLabel = t('courseCard.includeShort');
	$: excludeLabel = t('courseCard.excludeShort');
	$: noneLabel = t('courseCard.noneShort');
	$: conflictLabel = t('courseCard.conflict');

let titleElement: HTMLDivElement | null = null;
let truncatedTitleTooltip: string | null = null;
$: locationLabel =
	typeof specialInfo === 'string' && specialInfo.trim().length > 0
		? specialInfo.trim()
		: t('courseCard.locationPending');

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
	aria-label={`${title} - ${teacher} - ${time}`}
>
	<div class="color-marker" style={`background:${markerColor};`}></div>
	{#if selectable}
		<div class="select-col">
			<button
				type="button"
				class={`intent-toggle ${selectState ?? 'neutral'}`}
				on:click={onToggleSelect}
				aria-label={t('courseCard.markSelection')}
			>
				{selectState === 'include' ? includeLabel : selectState === 'exclude' ? excludeLabel : noneLabel}
			</button>
		</div>
	{/if}
	{#if showRing}
		<div class="capacity-col left">
			<div class="ring" style={`--ring-color:${ringStyle(ringState)};`}>
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
	<div class="card-body">
		<div class="column title-col">
			<div class="title-row">
				<div
					class="title"
					bind:this={titleElement}
					title={truncatedTitleTooltip ?? undefined}
					aria-label={truncatedTitleTooltip ?? undefined}
				>
					{title}
				</div>
				{#if showConflictBadge}
					<div class="conflict-badge" title={conflictLabel}>
						{conflictLabel}
						{#if conflictDetails && conflictDetails.length}
							<div class="conflict-popover">
								<ul>
									{#each conflictDetails as detail, idx (idx)}
										<li>{detail.label}{detail.value ? `：${detail.value}` : ''}</li>
									{/each}
								</ul>
							</div>
						{:else}
							<div class="conflict-popover empty">{t('courseCard.conflictNone') ?? '暂无冲突数据'}</div>
						{/if}
					</div>
				{/if}
				{#if specialTags.length}
					<div class="tags">
						{#each specialTags as tag}
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
			{#if !collapsed}
				<div class="subtext">
					<span>{teacher || t('courseCard.teacherPending')}</span>
					{#if teacherId}
						<span class="divider">·</span>
						<span>{teacherId}</span>
					{/if}
				</div>
			{/if}
		</div>
		<div class="column time-col">
			<div class="label">{t('courseCard.timeLabel')}</div>
			<div class="value">{time || t('courseCard.noTime')}</div>
		</div>
		<div class="column info-col">
			<div class="label">{t('courseCard.infoLabel')}</div>
			<div class="value">
				{#if !collapsed}
					<span class="info-primary">{locationLabel}</span>
					{#if crossCampusEnabled && campus}
						<span class="divider" aria-hidden="true">·</span>
						<span class="info-campus">{campus}</span>
					{/if}
				{:else}
					—
				{/if}
			</div>
		</div>
		<div class="actions">
			<slot name="actions" />
		</div>
	</div>
</article>
