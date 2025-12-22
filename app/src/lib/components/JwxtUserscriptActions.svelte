<svelte:options runes={false} />

<script lang="ts">
	import { browser, dev } from '$app/environment';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { getUserscriptConfig, type UserscriptConfig } from '../../config/userscript';

	export let config: UserscriptConfig = getUserscriptConfig();
	export let size: 'sm' | 'md' | 'lg' = 'sm';

	export let installLabel = '';
	export let helpLabel = '';

	function installUserscriptNow() {
		if (!browser) return;
		// Userscript managers require a real user-gesture navigation to the *.user.js URL.
		// Avoid async work here to prevent popup blockers or gesture loss in dev mode.
		const url = new URL(config.scriptUrl, window.location.origin);
		// Cache-bust in dev so updating the userscript triggers reinstall.
		if (dev) url.searchParams.set('t', String(Date.now()));

		// Force a real top-level navigation (bypass SvelteKit client-side routing interception),
		// otherwise some script managers won't show the install UI.
		window.location.assign(url.toString());
	}

	function openHelp() {
		if (!browser) return;
		window.open(config.helpUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
	<AppButton class="w-full sm:w-auto" variant="secondary" {size} on:click={installUserscriptNow}>
		{installLabel || 'Install userscript'}
	</AppButton>
	<AppButton class="w-full sm:w-auto" variant="secondary" {size} on:click={openHelp}>
		{helpLabel || 'Help'}
	</AppButton>
</div>
