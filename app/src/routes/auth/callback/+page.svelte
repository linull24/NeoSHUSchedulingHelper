<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { translator } from '$lib/i18n';
	import type { TranslateFn } from '$lib/i18n';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { completeGithubPkceCallback } from '$lib/policies/github/oauthPkce';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let status = '';
	let token: string | null = null;
	let closeBlocked = false;

	onMount(async () => {
		status = t('panels.sync.statuses.githubAuthorizing');

		// Prefer delivering the code/state to the opener, and let the opener complete the token exchange.
		// This avoids relying on `window.opener` (may be severed by COOP) and avoids CORS in the popup.
		const url = new URL(window.location.href);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');

		if (code && state) {
			deliverCallback({ code, state });
			status = t('panels.sync.statuses.githubLoginSuccess');
			setTimeout(() => tryCloseOrFallback(), 350);
			return;
		}

		const result = await completeGithubPkceCallback(url);
		if (!result.ok) {
			status = t(result.errorKey, result.values);
			setTimeout(() => tryCloseOrFallback(), 700);
			return;
		}

		token = result.token;
		status = t('panels.sync.statuses.githubLoginSuccess');
		deliverToken(token);
		tryCloseOrFallback();
	});

	function deliverCallback(payload: { code: string; state: string }) {
		const code = String(payload.code || '').trim();
		const state = String(payload.state || '').trim();
		if (!code || !state) return;

		try {
			window.opener?.postMessage({ type: 'github-oauth-code', code, state }, window.location.origin);
		} catch {
			// ignore
		}

		try {
			if (typeof BroadcastChannel !== 'undefined') {
				const channel = new BroadcastChannel('neoxk:github-oauth');
				channel.postMessage({ type: 'github-oauth-code', code, state });
				channel.close();
			}
		} catch {
			// ignore
		}
	}

	function deliverToken(tokenValue: string) {
		const trimmed = String(tokenValue || '').trim();
		if (!trimmed) return;

		try {
			localStorage.setItem('githubToken', trimmed);
			localStorage.setItem('githubToken:lastSetAt', String(Date.now()));
		} catch {
			// ignore
		}

		try {
			window.opener?.postMessage({ type: 'github-token', token: trimmed }, window.location.origin);
		} catch {
			// ignore
		}

		try {
			if (typeof BroadcastChannel !== 'undefined') {
				const channel = new BroadcastChannel('neoxk:github-oauth');
				channel.postMessage({ type: 'github-token', token: trimmed });
				channel.close();
			}
		} catch {
			// ignore
		}
	}

	function tryCloseOrFallback() {
		closeBlocked = false;
		try {
			window.close();
		} catch {
			// ignore
		}

		setTimeout(() => {
			try {
				window.close();
			} catch {
				// ignore
			}

			// If the browser blocks closing (or opener is severed by COOP), redirect back to the app.
			closeBlocked = true;
			try {
				window.location.replace(`${base || ''}/`);
			} catch {
				// ignore
			}
		}, 400);
	}

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
				{#if closeBlocked}
					<AppButton type="button" variant="secondary" size="sm" on:click={tryCloseOrFallback}>
						{t('panels.sync.closeWindow')}
					</AppButton>
				{/if}
				<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
					{t('panels.sync.tokenHint')}
				</span>
			</div>
		{/if}
	</section>
</main>
