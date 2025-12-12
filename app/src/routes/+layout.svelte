<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
import { currentTheme } from '$lib/stores/uiTheme';
import { browser } from '$app/environment';
	import '@unocss/reset/tailwind.css';
	import 'virtual:uno.css';
	import '../../tokens/_base.css';
	import '../../tokens/theme.material.css';
	import '../../tokens/theme.fluent.css';
	import '../../tokens/theme.terminal.css';
	import '../../tokens/animations.css';

const theme = currentTheme;
let { children } = $props();

if (browser) {
	$effect(() => {
		const activeTheme = $theme ?? 'material';
		document.body.dataset.theme = activeTheme;
		document.documentElement.dataset.theme = activeTheme;
	});
}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
