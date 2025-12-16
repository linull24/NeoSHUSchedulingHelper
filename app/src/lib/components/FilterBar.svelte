<svelte:options runes={false} />

<script lang="ts">
	let hasMode = false;
	let hasSimple = false;
	let hasViewControls = false;
	let hasChips = false;
	let hasSettings = false;
	let hasAdvanced = false;

	$: hasMode = Boolean($$slots.mode);
	$: hasSimple = Boolean($$slots.simple);
	$: hasViewControls = Boolean($$slots['view-controls']);
	$: hasChips = Boolean($$slots.chips);
	$: hasSettings = Boolean($$slots.settings);
	$: hasAdvanced = Boolean($$slots.advanced);
</script>

<section
	class="flex w-full flex-col gap-4 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-5 text-[var(--app-text-md)] text-[var(--app-color-fg)] shadow-[var(--app-shadow-soft)]"
>
	{#if hasMode}
		<div class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
			<slot name="mode" />
		</div>
	{/if}

	{#if hasSimple}
		<div class="flex flex-wrap items-end gap-3">
			<slot name="simple" />
		</div>
	{/if}

	{#if hasViewControls}
		<div class="flex flex-wrap gap-3">
			<slot name="view-controls" />
		</div>
	{/if}

	{#if hasChips || hasSettings}
		<div class="filters flex flex-wrap items-start gap-3">
			<div class="chip-zone flex flex-1 flex-wrap gap-2 min-w-[220px]">
				<slot name="chips" />
			</div>
			<div class="settings-zone flex min-w-[96px] flex-col items-end gap-2">
				<slot name="settings" />
			</div>
		</div>
	{/if}

	{#if hasAdvanced}
		<slot name="advanced" />
	{/if}
</section>

<style>
	.filters {
		min-width: 0;
	}

	@container panel-shell (max-width: 640px) {
		.filters {
			flex-direction: column;
		}

		.filters .chip-zone,
		.filters .settings-zone {
			width: 100%;
			min-width: 0;
		}

		.filters .settings-zone {
			align-items: stretch;
		}
	}
</style>
