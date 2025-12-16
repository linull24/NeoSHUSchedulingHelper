<svelte:options runes={false} />

<script lang="ts">
	import AppButton from '$lib/primitives/AppButton.svelte';
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
	<AppButton variant="secondary" size="sm" on:click={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
		{t('pagination.prev')}
	</AppButton>

	<div class="flex items-center gap-1">
		{#each Array.from({ length: neighborRange.end - neighborRange.start + 1 }, (_, i) => neighborRange.start + i) as page}
			<AppButton
				variant={page === currentPage ? 'primary' : 'secondary'}
				size="sm"
				class="min-w-[36px] px-3"
				on:click={() => goTo(page)}
			>
				{page}
			</AppButton>
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

	<AppButton
		variant="secondary"
		size="sm"
		class="ml-auto"
		on:click={() => onPageChange(currentPage + 1)}
		disabled={currentPage >= totalPages}
	>
		{t('pagination.next')}
	</AppButton>
</div>
