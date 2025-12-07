<script lang="ts">
	let hasMode = false;
	let hasSimple = false;
	let hasViewControls = false;
	let hasChips = false;
	let hasSettings = false;
	let hasAdvanced = false;

	$: hasMode = Boolean($$slots?.mode);
	$: hasSimple = Boolean($$slots?.simple);
	$: hasViewControls = Boolean($$slots?.['view-controls']);
	$: hasChips = Boolean($$slots?.chips);
	$: hasSettings = Boolean($$slots?.settings);
	$: hasAdvanced = Boolean($$slots?.advanced);
</script>

<section class="filter-bar">
	{#if hasMode}
		<div class="filter-bar__mode">
			<slot name="mode" />
		</div>
	{/if}

	{#if hasSimple}
		<div class="filter-bar__simple">
			<slot name="simple" />
		</div>
	{/if}

	{#if hasViewControls}
		<div class="filter-bar__view-controls">
			<slot name="view-controls" />
		</div>
	{/if}

	{#if hasChips || hasSettings}
		<div class="filter-bar__filters">
			<div class="filter-bar__chips">
				<slot name="chips" />
			</div>
			<div class="filter-bar__settings">
				<slot name="settings" />
			</div>
		</div>
	{/if}

	{#if hasAdvanced}
		<div class="filter-bar__advanced">
			<slot name="advanced" />
		</div>
	{/if}
</section>

<style lang="scss" src="$lib/styles/filter-bar.scss"></style>
