<script lang="ts">
	import { onMount } from 'svelte';
	import { selectionModeNeedsPrompt } from '$lib/stores/coursePreferences';
	import SelectionModePrompt from './SelectionModePrompt.svelte';

	let showPrompt = false;

	onMount(() => {
		const unsubscribe = selectionModeNeedsPrompt.subscribe((needsPrompt) => {
			showPrompt = needsPrompt;
		});

		return () => {
			unsubscribe();
		};
	});

	function handleClose() {
		showPrompt = false;
	}
</script>

<SelectionModePrompt open={showPrompt} onClose={handleClose} />
