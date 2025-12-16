<script lang="ts">
	import { setSelectionMode } from '$lib/stores/coursePreferences';
	import type { SelectionMode } from '$lib/stores/coursePreferences';
	import { translator } from '$lib/i18n';
	import AppButton from '$lib/primitives/AppButton.svelte';

	export let open = false;
	export let onClose: (() => void) | undefined;

	let t = (key: string) => key;
	$: t = $translator;

	function choose(mode: SelectionMode) {
		setSelectionMode(mode);
		onClose?.();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,0.35)]" role="presentation">
		<div
			class="relative flex w-[min(420px,90vw)] flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-5 text-[var(--app-color-fg)] shadow-[var(--app-shadow-hard)]"
			role="dialog"
			aria-label={t('prompts.selectionMode.title')}
		>
			<h3 class="text-[var(--app-text-md)] font-semibold">{t('prompts.selectionMode.title')}</h3>
			<p class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('prompts.selectionMode.description')}</p>
			<div class="flex flex-wrap items-center justify-end gap-2">
				<AppButton variant="primary" size="sm" on:click={() => choose('allowOverflowMode')}>
					{t('prompts.selectionMode.allowOverflow')}
				</AppButton>
				<AppButton variant="secondary" size="sm" on:click={() => choose('overflowSpeedRaceMode')}>
					{t('prompts.selectionMode.speedRace')}
				</AppButton>
			</div>
			<AppButton
				variant="secondary"
				size="sm"
				iconOnly={true}
				class="absolute right-3 top-3 h-8 w-8 rounded-full bg-[var(--app-color-bg-muted)]"
				aria-label={t('prompts.selectionMode.close')}
				on:click={() => onClose?.()}
			>
				×
			</AppButton>
		</div>
	</div>
{/if}
