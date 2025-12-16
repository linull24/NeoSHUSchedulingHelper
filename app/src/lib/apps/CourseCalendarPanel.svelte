<script lang="ts">
	import { tick } from 'svelte';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import HoverInfoBar from '$lib/components/HoverInfoBar.svelte';
	import { translator } from '$lib/i18n';
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

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function resolveLength(value: string, base: number) {
		const trimmed = value.trim();
		if (!trimmed) return NaN;
		if (trimmed.endsWith('%')) return (parseFloat(trimmed) / 100) * base;
		if (trimmed.endsWith('px')) return parseFloat(trimmed);
		const raw = parseFloat(trimmed);
		return Number.isFinite(raw) ? raw : NaN;
	}

	function circledIndex(index: number) {
		const n = index + 1;
		if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + (n - 1));
		if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + (n - 21));
		if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + (n - 36));
		return String(n);
	}

	function courseBlock(node: HTMLButtonElement, params: { hasClipPath: boolean }) {
		if (typeof ResizeObserver === 'undefined') return;

		let current = params;
		let destroyed = false;

		const measureEl = node.querySelector<HTMLElement>('[data-role="measure"]');
		const indicatorEl = node.querySelector<HTMLElement>('[data-role="indicator"]');

		async function update() {
			await tick();
			if (destroyed) return;

			const mode = current.hasClipPath
				? 'indicator'
				: !measureEl
					? 'text'
					: measureEl.scrollHeight <= measureEl.clientHeight + 1 &&
							measureEl.scrollWidth <= measureEl.clientWidth + 1
						? 'text'
						: 'indicator';

			if (node.dataset.labelMode !== mode) node.dataset.labelMode = mode;

			if (!indicatorEl) return;

			const width = node.clientWidth;
			const height = node.clientHeight;
			const indicatorWidth = indicatorEl.offsetWidth || indicatorEl.getBoundingClientRect().width;
			const indicatorHeight = indicatorEl.offsetHeight || indicatorEl.getBoundingClientRect().height;

			if (!(width > 0 && height > 0 && indicatorWidth > 0 && indicatorHeight > 0)) return;

			const margin = 2;
			const maxW = Math.max(1, width - margin * 2);
			const maxH = Math.max(1, height - margin * 2);
			const scale = Math.min(1, maxW / indicatorWidth, maxH / indicatorHeight);
			node.style.setProperty('--indicator-scale', String(scale));

			const computed = getComputedStyle(node);
			const rawX = computed.getPropertyValue('--indicator-x') || '50%';
			const rawY = computed.getPropertyValue('--indicator-y') || '50%';

			const targetX = resolveLength(rawX, width);
			const targetY = resolveLength(rawY, height);

			const halfW = (indicatorWidth * scale) / 2;
			const halfH = (indicatorHeight * scale) / 2;

			const clampedX = clamp(Number.isFinite(targetX) ? targetX : width / 2, halfW + margin, width - halfW - margin);
			const clampedY = clamp(Number.isFinite(targetY) ? targetY : height / 2, halfH + margin, height - halfH - margin);

			node.style.setProperty('--indicator-x-px', `${clampedX}px`);
			node.style.setProperty('--indicator-y-px', `${clampedY}px`);
		}

		const ro = new ResizeObserver(() => void update());
		ro.observe(node);
		if (measureEl) ro.observe(measureEl);

		void update();

		return {
			update(next: { hasClipPath: boolean }) {
				current = next;
				void update();
			},
			destroy() {
				destroyed = true;
				ro.disconnect();
			}
		};
	}
</script>

<DockPanelShell>
	<ListSurface
		title={$translator('calendar.title')}
		enableStickyToggle={false}
		density="compact"
		bodyScrollable={false}
		bodyPadding={false}
	>
			<div
				class="calendar-surface flex flex-1 min-h-0 flex-col gap-4 w-full overflow-hidden font-sans leading-[1.1] text-[var(--app-color-fg)] [container-type:inline-size] [container-name:cal] [--cal-font:clamp(3px,2.2cqi,14px)] [--cal-font-sm:clamp(3px,1.8cqi,12px)] [--period-min:clamp(28px,4.2cqi,88px)] text-[var(--cal-font)]"
			>
				<div class="calendar-grid flex flex-col gap-3 flex-1 min-h-0 w-full cal-unify">
					<div class="calendar-scroll min-h-0 min-w-0 w-full flex-1 overflow-auto flex flex-col [scrollbar-gutter:stable] cal-unify">
						<div
							class="calendar-table grid w-full flex-1 min-h-0 cal-unify gap-0 [min-height:100%] [--calendar-border:color-mix(in_srgb,var(--app-color-border-subtle)_80%,transparent)] [min-width:max(100%,calc(var(--calendar-time-min,48px)+var(--calendar-day-count,5)*var(--calendar-day-min,58px)))] [&>*]:min-w-0 [&>*]:min-h-0"
							style={$tableStyle}
							aria-label={$translator('calendar.title')}
						>
		<div class="corner cal-unify"></div>
		{#each $weekdays as dayLabel, dayIndex (dayIndex)}
			<div
				class="table-header cal-unify text-center font-semibold text-[var(--cal-font-sm)] leading-tight px-[clamp(2px,0.8cqi,8px)] py-[clamp(2px,0.8cqi,8px)] border-l border-[var(--calendar-border)] first:border-l-0"
				style={`grid-column:${dayIndex + 2};`}
			>
				{dayLabel}
			</div>
		{/each}

		{#each periods as period, rowIndex (rowIndex)}
			{@const slotLabel =
				(period as any).label ??
				`${$translator('calendar.slotPrefix')}${rowIndex + 1}${$translator('calendar.slotSuffix')}`}
			{@const slotNumber = rowIndex + 1}
			{@const rangeStart = period.start ?? '??'}
			{@const rangeEnd = period.end ?? '??'}
			<div
				class="time-cell cal-unify flex items-baseline justify-between gap-2 p-[clamp(2px,0.7cqi,8px)] text-[var(--cal-font-sm)] border-t border-[var(--calendar-border)]"
				style={`grid-row:${rowIndex + 2};`}
			>
				<strong class="time-label font-semibold" aria-label={slotLabel}>
					<span class="slot-label-full inline">{slotLabel}</span>
					<span class="slot-label-compact hidden" aria-hidden="true">{slotNumber}</span>
				</strong>
				<span class="time-range hidden text-[var(--app-color-fg-muted)]">{rangeStart} - {rangeEnd}</span>
			</div>
			{#each $weekdays as _, dayIndex (dayIndex)}
				<div
					role="button"
					class="table-cell cal-unify relative bg-transparent border-t border-l border-[var(--calendar-border)] min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] focus:outline-none app-elevate-soft hover:z-2 focus-visible:z-3 hover:bg-[var(--app-color-hover-highlight)] focus-visible:bg-[var(--app-color-hover-highlight)] focus-visible:[outline:2px_solid_var(--app-color-focus-ring)] focus-visible:[outline-offset:-2px]"
					style={`grid-row:${rowIndex + 2}; grid-column:${dayIndex + 2};`}
					onmouseenter={() => handleCellHover(dayIndex, rowIndex)}
					onmouseleave={handleCellLeave}
					tabindex="0"
				></div>
			{/each}
		{/each}

		{#each $visibleEntries as entry, index (entry.key)}
			{@const hasClipPath = getClipPath(entry) !== 'none'}
			{@const isHighlighted = $activeId === entry.id}
			{@const initialLabelMode = hasClipPath ? 'indicator' : shouldShowLabel(entry) ? 'text' : 'indicator'}
			{@const blockClass = [
				'course-block',
				'cal-unify text-left min-w-0 min-h-0 relative overflow-hidden rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-color-border-subtle)_70%,transparent)] p-[clamp(2px,0.8cqi,8px)] bg-transparent cursor-pointer app-elevate-strong z-4 hover:z-20 focus:outline-none focus-visible:[outline:2px_solid_var(--app-color-focus-ring-inverse)] focus-visible:outline-offset-2',
				initialLabelMode === 'text' ? 'labelled' : 'compact',
				isHighlighted
					? 'active highlighted z-30 translate-y-[var(--app-elevation-hover-translate-y)] [filter:var(--app-elevation-hover-filter)]'
					: '',
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
				data-label-mode={initialLabelMode}
				use:courseBlock={{ hasClipPath }}
				onmouseenter={() => handleEntryHover(entry)}
				onfocus={() => handleEntryHover(entry)}
				onmouseleave={handleEntryLeave}
				onblur={handleEntryLeave}
				aria-label={`${entry.title} ${entry.location}`}
			>
				<span class="course-bg" aria-hidden="true"></span>
				<div class="course-body h-full w-full min-h-0 min-w-0 flex flex-col">
					<div
						class="course-text flex flex-1 flex-col gap-1 min-h-0 min-w-0 overflow-hidden whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]"
					>
						<strong class="font-semibold leading-tight">{entry.title}</strong>
						<small class="leading-tight opacity-90">{entry.location}</small>
					</div>
					<div
						class="course-measure flex flex-col gap-1 min-h-0 min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word]"
						data-role="measure"
						aria-hidden="true"
					>
						<strong class="font-semibold leading-tight">{entry.title}</strong>
						<small class="leading-tight opacity-90">{entry.location}</small>
					</div>
				</div>
				<div
					class="course-indicator font-semibold leading-none select-none"
					data-role="indicator"
					aria-hidden="true"
				>
					{circledIndex(index)}
				</div>
			</button>
		{/each}
	</div>
				</div>
			</div>
			<HoverInfoBar className="calendar-hover mt-auto" />
		</div>
	</ListSurface>
</DockPanelShell>

<style>
	:global(.dv-groupview),
	:global(.dv-content-container),
	:global(.dv-content-container > *) {
		height: 100%;
		min-height: 0;
	}

	@container cal (min-width: 520px) {
		.calendar-surface .time-range {
			display: inline;
		}
	}

	@container cal (max-width: 360px) {
		.calendar-surface {
			--cal-font: clamp(3px, 2.2cqi, 11px);
			--cal-font-sm: clamp(3px, 1.8cqi, 10px);
			--period-min: clamp(24px, 4cqi, 60px);
		}

		.calendar-surface .slot-label-full {
			display: none;
		}

		.calendar-surface .slot-label-compact {
			display: inline;
		}

		.calendar-surface .time-range {
			display: none;
		}
	}

	@container cal (max-width: 280px) {
		.calendar-surface {
			--cal-font: 3px;
			--cal-font-sm: 3px;
			--period-min: 20px;
		}
	}

	.course-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
		background: var(--course-bg);
		clip-path: var(--course-clip-path);
	}

	.course-block.with-clip {
		clip-path: var(--course-clip-path);
		-webkit-clip-path: var(--course-clip-path);
	}

	.course-measure {
		position: absolute;
		inset: 0;
		visibility: hidden;
		pointer-events: none;
		overflow: hidden;
	}

	.course-body {
		position: relative;
		z-index: 1;
	}

	.course-indicator {
		position: absolute;
		z-index: 2;
		color: #fff;
		left: var(--indicator-x-px, var(--indicator-x, 50%));
		top: var(--indicator-y-px, var(--indicator-y, 50%));
		transform: translate(-50%, -50%) scale(var(--indicator-scale, 1));
		transform-origin: center;
		background: transparent;
		border: 0;
		padding: 0;
		pointer-events: none;
		text-shadow: 0 1px 2px color-mix(in srgb, var(--app-color-bg) 60%, transparent);
	}

	.course-block[data-label-mode='text'] .course-indicator {
		opacity: 0;
	}

	.course-block[data-label-mode='indicator'] .course-text {
		opacity: 0;
	}
</style>
