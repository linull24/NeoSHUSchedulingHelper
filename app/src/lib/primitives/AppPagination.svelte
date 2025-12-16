<svelte:options runes={false} />

<script lang="ts">
	import { translator } from '$lib/i18n';
	import { onMount } from 'svelte';

	export let currentPage: number;
	export let totalPages: number;
	export let pageNeighbors: number;
	export let onPageChange: (page: number) => void;

	let host: HTMLDivElement;
	let width = 0;
	let ro: ResizeObserver | null = null;

	let t = (key: string) => key;
	$: t = $translator;

	$: effectiveNeighbors = (() => {
		const maxNeighbors = Math.max(0, Math.floor(pageNeighbors));
		if (maxNeighbors === 0) return 0;
		if (width < 160) return 0;
		if (width < 220) return Math.min(1, maxNeighbors);
		if (width < 300) return Math.min(2, maxNeighbors);
		if (width < 380) return Math.min(3, maxNeighbors);
		if (width < 480) return Math.min(4, maxNeighbors);
		if (width < 600) return Math.min(5, maxNeighbors);
		return Math.min(6, maxNeighbors);
	})();

	let jumpDraft = '';
	let jumpFocused = false;
	$: if (!jumpFocused) jumpDraft = String(currentPage);

	function handleInputChange(e: Event) {
		const value = Number((e.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) return;
		navigateTo(value);
	}

	function navigateTo(page: number) {
		const next = Math.min(Math.max(page, 1), totalPages);
		if (!Number.isFinite(next)) return;
		onPageChange(next);
		requestAnimationFrame(() => {
			const body = host.closest('.list-surface__body') as HTMLElement | null;
			body?.scrollTo({ top: 0, behavior: 'auto' });
		});
	}

	function commitJump() {
		const value = Number(jumpDraft);
		if (!Number.isFinite(value)) return;
		navigateTo(value);
	}

	$: pageTokens = buildPageTokens({
		currentPage,
		totalPages,
		neighbors: effectiveNeighbors
	});

	onMount(() => {
		width = host?.getBoundingClientRect().width ?? 0;
		if (typeof ResizeObserver === 'undefined') return;
		ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
			}
		});
		ro.observe(host);
		return () => ro?.disconnect();
	});

	type PageToken =
		| { kind: 'page'; value: number; current: boolean }
		| { kind: 'ellipsis'; id: string };

	function buildPageTokens({
		currentPage,
		totalPages,
		neighbors
	}: {
		currentPage: number;
		totalPages: number;
		neighbors: number;
	}): PageToken[] {
		if (totalPages <= 1) return [];
		const clampedCurrent = Math.min(Math.max(currentPage, 1), totalPages);

		const pages = new Set<number>([1, totalPages, clampedCurrent]);
		for (let offset = 1; offset <= neighbors; offset += 1) {
			pages.add(clampedCurrent - offset);
			pages.add(clampedCurrent + offset);
		}

		const sorted = Array.from(pages)
			.filter((p) => p >= 1 && p <= totalPages)
			.sort((a, b) => a - b);

		const tokens: PageToken[] = [];
		for (let idx = 0; idx < sorted.length; idx += 1) {
			const page = sorted[idx];
			const prev = sorted[idx - 1];
			if (idx > 0 && prev != null && page - prev > 1) {
				tokens.push({ kind: 'ellipsis', id: `e:${prev}:${page}` });
			}
			tokens.push({ kind: 'page', value: page, current: page === clampedCurrent });
		}
		return tokens;
	}
</script>

<div bind:this={host} class="w-full min-w-0">
	{#if pageTokens.length}
		<nav
			aria-label={t('pagination.jump')}
			class="flex items-center gap-2 py-2 min-w-0 [container-type:inline-size]"
		>
			<div class="flex items-center gap-1 min-w-0 flex-nowrap overflow-hidden">
				{#each pageTokens as token (token.kind === 'page' ? `p:${token.value}` : token.id)}
					{#if token.kind === 'ellipsis'}
						<span class="px-2 text-[clamp(var(--app-text-xs),2.2cqi,var(--app-text-sm))] text-[var(--app-color-fg-muted)] select-none">…</span>
					{:else}
						<button
							type="button"
							class={`h-7 min-w-7 px-2 rounded-[var(--app-radius-md)] border text-[clamp(var(--app-text-xs),2.2cqi,var(--app-text-sm))] tabular-nums transition-colors duration-150 ${
								token.current
									? 'border-[color:var(--app-color-primary)] bg-[color-mix(in_srgb,var(--app-color-primary)_16%,var(--app-color-bg))] text-[var(--app-color-fg)]'
									: 'border-[color:var(--app-color-border-subtle)] bg-transparent text-[var(--app-color-fg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]'
							}`.trim()}
							aria-current={token.current ? 'page' : undefined}
							on:click={() => navigateTo(token.value)}
						>
							{token.value}
						</button>
					{/if}
				{/each}
			</div>

			<input
				type="number"
				class="ml-auto h-7 w-[clamp(3rem,12cqi,4.5rem)] rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 text-center text-[clamp(var(--app-text-xs),2.2cqi,var(--app-text-sm))] tabular-nums"
				min="1"
				max={totalPages}
				bind:value={jumpDraft}
				aria-label={t('pagination.jump')}
				on:focus={() => (jumpFocused = true)}
				on:blur={() => {
					jumpFocused = false;
					commitJump();
				}}
				on:keydown={(event) => {
					if (event.key !== 'Enter') return;
					commitJump();
					(event.currentTarget as HTMLInputElement).blur();
				}}
				on:change={handleInputChange}
			/>
		</nav>
	{/if}
</div>
