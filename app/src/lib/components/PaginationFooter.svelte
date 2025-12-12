<svelte:options runes={false} />

<script lang="ts">
import { translator } from '$lib/i18n';

export let currentPage: number;
export let totalPages: number;
export let pageNeighbors: number;
export let onPageChange: (page: number) => void;

let t = (key: string) => key;
$: t = $translator;

$: neighborRange = (() => {
	const count = Math.max(1, pageNeighbors);
	const start = Math.max(1, currentPage - count);
	const end = Math.min(totalPages, currentPage + count);
	return { start, end };
})();

const formatTotalPages = (count: number) =>
	t('filters.totalPages').replace('{count}', String(count));

function handleInputChange(e: Event) {
	const value = Number((e.currentTarget as HTMLInputElement).value);
	onPageChange(value);
}
function goTo(page: number) {
	onPageChange(Math.min(Math.max(page, 1), totalPages));
}
</script>

<div class="flex flex-wrap items-center gap-2 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
	<button
		type="button"
		class="inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]"
		on:click={() => onPageChange(currentPage - 1)}
		disabled={currentPage <= 1}
	>
		{t('pagination.prev')}
	</button>

	<div class="flex items-center gap-1">
		{#each Array.from({ length: neighborRange.end - neighborRange.start + 1 }, (_, i) => neighborRange.start + i) as page}
			<button
				type="button"
				class={`inline-flex min-w-[36px] items-center justify-center rounded-[var(--app-radius-md)] border px-3 py-2 text-[var(--app-text-sm)] transition-colors ${
					page === currentPage
						? 'border-transparent bg-[var(--app-color-primary)] text-[var(--app-color-on-primary)] font-medium'
						: 'border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]'
				}`}
				on:click={() => goTo(page)}
			>
				{page}
			</button>
		{/each}
	</div>

	<label class="inline-flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
		<span>{t('filters.jump')}</span>
		<input
			type="number"
			class="w-20 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1 text-center"
			min="1"
			max={totalPages}
			value={currentPage}
			on:change={handleInputChange}
		/>
	</label>

	<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{formatTotalPages(totalPages)}</span>

	<button
		type="button"
		class="inline-flex items-center rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)] ml-auto"
		on:click={() => onPageChange(currentPage + 1)}
		disabled={currentPage >= totalPages}
	>
		{t('pagination.next')}
	</button>
</div>
