<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { translator } from '$lib/i18n';
	import type { TranslateFn } from '$lib/i18n';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { completeGithubPkceCallback } from '$lib/policies/github/oauthPkce';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let status = '';
	let token: string | null = null;

	onMount(async () => {
		status = t('panels.sync.statuses.githubAuthorizing');

		const result = await completeGithubPkceCallback(new URL(window.location.href));
		if (!result.ok) {
			status = t(result.errorKey, result.values);
			return;
		}

		token = result.token;
		status = t('panels.sync.statuses.githubLoginSuccess');

		try {
			window.opener?.postMessage({ type: 'github-token', token }, window.location.origin);
			window.close();
		} catch {
			// ignore
		}
	});

	async function copyToken() {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(token);
			status = t('panels.sync.statuses.copySuccess');
		} catch {
			status = token;
		}
	}
</script>

<main class="min-h-dvh flex items-center justify-center bg-[var(--app-color-bg)] p-6">
	<section class="w-full max-w-[560px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-5 shadow-[var(--app-shadow-soft)]">
		<h1 class="m-0 text-[var(--app-text-lg)] font-semibold text-[var(--app-color-fg)]">{t('panels.sync.gistTitle')}</h1>
		<p class="mt-2 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{status}</p>

		{#if token}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<AppButton type="button" variant="primary" size="sm" on:click={copyToken}>
					{t('panels.sync.copyButton')}
				</AppButton>
			</div>
		{/if}
	</section>
</main>
