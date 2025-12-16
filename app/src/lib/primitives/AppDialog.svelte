<svelte:options runes={false} />

<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let open = false;
	export let title: string | null = null;
	export let closeOnBackdrop = true;
	export let closeOnEsc = true;
	export let className = '';
	export { className as class };

	const dispatch = createEventDispatcher<{ close: void }>();

	let dialogEl: HTMLDialogElement | null = null;

	function bindDialog(node: HTMLDialogElement) {
		dialogEl = node;
		ensureOpenState();
		return () => {
			if (dialogEl === node) dialogEl = null;
		};
	}

	function requestClose() {
		dispatch('close');
	}

	function handleCancel(event: Event) {
		if (!closeOnEsc) {
			event.preventDefault();
			return;
		}
		event.preventDefault();
		requestClose();
	}

	function handleClick(event: MouseEvent) {
		if (!closeOnBackdrop) return;
		if (event.target === dialogEl) {
			requestClose();
		}
	}

	function ensureOpenState() {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	}

	$: ensureOpenState();

	onDestroy(() => {
		try {
			if (dialogEl?.open) dialogEl.close();
		} catch {
			// ignore
		}
	});
</script>

<dialog
	{@attach bindDialog}
	class={`app-dialog m-auto w-[min(560px,calc(100vw-2.5rem))] overflow-visible rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-0 text-[var(--app-color-fg)] shadow-[var(--app-shadow-hard)] ${className}`.trim()}
	on:cancel={handleCancel}
	on:click={handleClick}
	aria-modal="true"
>
	<div class="flex flex-col gap-4 p-5">
		{#if title}
			<header class="flex items-start justify-between gap-4">
				<h3 class="m-0 text-[var(--app-text-lg)] font-semibold">{title}</h3>
			</header>
		{/if}

		<section class="flex flex-col gap-3 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
			<slot />
		</section>

		<footer class="flex flex-wrap items-center justify-end gap-2">
			<slot name="actions" />
		</footer>
	</div>
</dialog>

<style>
	:global(.app-dialog::backdrop) {
		background: color-mix(in srgb, var(--app-color-bg) 65%, transparent);
		backdrop-filter: blur(10px);
	}
</style>
