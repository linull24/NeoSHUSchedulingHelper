<script lang="ts">
	let hasSearch = false;
	let hasFilters = false;
	let hasFooter = false;

	export let title: string | null = null;
	export let subtitle: string | null = null;
	export let count: number | null = null;
	export let density: 'comfortable' | 'compact' = 'comfortable';

	$: hasSearch = Boolean($$slots?.search);
	$: hasFilters = Boolean($$slots?.filters) || Boolean($$slots?.['filters-settings']);
	$: hasFooter = Boolean($$slots?.footer);
</script>

<section class="list-surface" data-density={density}>
	<header class="list-surface__header">
		<div class="list-surface__header-main">
			{#if title}
				<div class="title-block">
					<h5>{title}</h5>
					{#if subtitle}<small>{subtitle}</small>{/if}
				</div>
			{/if}
			<slot name="header-meta" />
		</div>
		<div class="list-surface__header-actions">
			{#if typeof count === 'number'}
				<span class="count">{count} 条</span>
			{/if}
			<slot name="header-actions" />
		</div>
	</header>

	<div class:empty={!hasSearch} class="list-surface__search">
		<slot name="search" />
	</div>

	<div class:empty={!hasFilters} class="list-surface__filters">
		<div class="filters-main">
			<slot name="filters" />
		</div>
		<div class="filters-settings">
			<slot name="filters-settings" />
		</div>
	</div>

	<div class="list-surface__body">
		<slot />
	</div>

	<footer class:empty={!hasFooter} class="list-surface__footer">
		<slot name="footer" />
	</footer>
</section>

<style lang="scss" src="$lib/styles/list-surface.scss"></style>
