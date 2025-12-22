<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { jwxtGetStatus } from '$lib/data/jwxt/jwxtApi';
	import { dispatchTermActionWithEffects, ensureTermStateLoaded, termState } from '$lib/stores/termStateStore';
	import type { JwxtPair } from '$lib/data/termState/types';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	const DEBOUNCE_MS = 1200;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let initialized = false;
	let lastSelectedSig: string | null = null;
	let inFlight = false;

	let confirmOpen = false;
	let confirmBusy = false;
	let confirmError = '';
	let pendingDiff: { toEnroll: JwxtPair[]; toDrop: JwxtPair[] } | null = null;
	let confirmBody = '';

	function formatPair(pair: JwxtPair) {
		return `${pair.kchId} · ${pair.jxbId}`;
	}

	function limitList(items: string[], max = 20) {
		if (items.length <= max) return { items, more: 0 };
		return { items: items.slice(0, max), more: items.length - max };
	}

	function clearDebounce() {
		if (!debounceTimer) return;
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	function readHistoryErrorSince(args: { beforeLen: number; prefix: string }) {
		const snapshot = get(termState);
		const slice = (snapshot?.history?.entries ?? []).slice(Math.max(0, args.beforeLen));
		for (const entry of slice) {
			if (!entry?.id || typeof entry.id !== 'string') continue;
			if (!entry.id.startsWith(args.prefix)) continue;
			const error = entry.details?.error;
			return typeof error === 'string' && error.trim() ? error.trim() : 'FAILED';
		}
		return null;
	}

	function hasHistoryEntrySince(args: { beforeLen: number; prefix: string }) {
		const snapshot = get(termState);
		const slice = (snapshot?.history?.entries ?? []).slice(Math.max(0, args.beforeLen));
		return slice.some((entry) => typeof entry?.id === 'string' && entry.id.startsWith(args.prefix));
	}

	function scheduleAutoPush() {
		const state = get(termState);
		if (!state) return;
		if (!state.settings.jwxt.autoPushEnabled) return;
		if (!initialized) return;
		if (confirmOpen || confirmBusy || inFlight) return;

		clearDebounce();
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			void maybeAutoPush();
		}, DEBOUNCE_MS);
	}

	async function maybeAutoPush() {
		const state = get(termState);
		if (!state) return;
		if (!state.settings.jwxt.autoPushEnabled) return;
		if (confirmOpen || confirmBusy || inFlight) return;

		const status = await jwxtGetStatus();
		if (!status.ok || !status.supported || !status.loggedIn) return;

		if (state.jwxt.syncState === 'NEEDS_PULL') {
			const beforeLen = state.history.entries.length;
			const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'JWXT_PULL_REMOTE' });
			const dispatched = await result;
			if (!dispatched.ok) return;
			await effectsDone;
			const pullErr = readHistoryErrorSince({ beforeLen, prefix: 'jwxt:pull-err:' });
			if (pullErr) return;
		}

		const preview = dispatchTermActionWithEffects({ type: 'JWXT_PREVIEW_PUSH', ttlMs: 0 });
		const previewDispatched = await preview.result;
		if (!previewDispatched.ok) return;
		await preview.effectsDone;

		const afterPreview = get(termState);
		const ticket = afterPreview?.jwxt.pushTicket;
		if (!ticket) return;
		if (!ticket.diff.toEnroll.length && !ticket.diff.toDrop.length) return;

		pendingDiff = ticket.diff;
		confirmBody = t('panels.jwxt.confirm.autoPushBody', {
			enroll: ticket.diff.toEnroll.length,
			drop: ticket.diff.toDrop.length
		});
		confirmError = '';
		confirmOpen = true;
	}

	async function handleConfirm() {
		if (!pendingDiff) return;
		try {
			confirmBusy = true;
			inFlight = true;
			confirmError = '';

			const beforeLen = get(termState)?.history?.entries?.length ?? 0;
			const push = dispatchTermActionWithEffects({ type: 'JWXT_CONFIRM_PUSH' });
			const pushed = await push.result;
			if (!pushed.ok) throw new Error(pushed.error.message);
			await push.effectsDone;
			const pushErr = readHistoryErrorSince({ beforeLen, prefix: 'jwxt:push-err:' });
			if (pushErr) throw new Error(pushErr);
			if (hasHistoryEntrySince({ beforeLen, prefix: 'jwxt:frozen:push:' })) throw new Error('PUSH_PARTIAL_FAILURE');

			const after = get(termState);
			if (after?.jwxt.syncState === 'REMOTE_DIRTY' && after.jwxt.pushTicket) {
				pendingDiff = after.jwxt.pushTicket.diff;
				confirmBody = t('panels.jwxt.confirm.remoteChangedBody');
				return;
			}

			confirmOpen = false;
			pendingDiff = null;
		} catch (error) {
			confirmError = error instanceof Error ? error.message : String(error);
		} finally {
			inFlight = false;
			confirmBusy = false;
		}
	}

	onMount(() => {
		void ensureTermStateLoaded();
		const unsubscribe = termState.subscribe((state) => {
			const sig = state?.selection.selectedSig ? (state.selection.selectedSig as unknown as string) : null;
			if (!initialized) {
				initialized = true;
				lastSelectedSig = sig;
				return;
			}
			if (!sig || sig === lastSelectedSig) return;
			lastSelectedSig = sig;
			scheduleAutoPush();
		});
		return () => unsubscribe();
	});

	onDestroy(() => {
		clearDebounce();
	});

	$: enrollItems = pendingDiff ? pendingDiff.toEnroll.map(formatPair) : [];
	$: dropItems = pendingDiff ? pendingDiff.toDrop.map(formatPair) : [];
	$: enrollLimited = limitList(enrollItems);
	$: dropLimited = limitList(dropItems);
	$: enrollDisplay =
		enrollLimited.more > 0 ? [...enrollLimited.items, t('panels.jwxt.confirm.pushDiffMore', { count: enrollLimited.more })] : enrollLimited.items;
	$: dropDisplay =
		dropLimited.more > 0 ? [...dropLimited.items, t('panels.jwxt.confirm.pushDiffMore', { count: dropLimited.more })] : dropLimited.items;
</script>

<AppDialog
	open={confirmOpen}
	title={t('panels.jwxt.confirm.autoPushTitle')}
	on:close={() => {
		if (confirmBusy) return;
		confirmOpen = false;
		confirmError = '';
	}}
>
	<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
		{confirmBody || t('panels.jwxt.confirm.autoPushBody', { enroll: enrollItems.length, drop: dropItems.length })}
	</p>

	<div class="mt-3 flex flex-col gap-3">
		<div class="flex flex-col gap-2">
			<p class="m-0 text-[var(--app-text-xs)] font-medium text-[var(--app-color-fg)]">{t('panels.jwxt.confirm.pushDiffEnrollTitle')}</p>
			{#if enrollDisplay.length}
				<ul class="m-0 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
					{#each enrollDisplay as item (item)}
						<li class="break-words [overflow-wrap:anywhere]">{item}</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.confirm.pushDiffEmpty')}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<p class="m-0 text-[var(--app-text-xs)] font-medium text-[var(--app-color-fg)]">{t('panels.jwxt.confirm.pushDiffDropTitle')}</p>
			{#if dropDisplay.length}
				<ul class="m-0 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
					{#each dropDisplay as item (item)}
						<li class="break-words [overflow-wrap:anywhere]">{item}</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.confirm.pushDiffEmpty')}</p>
			{/if}
		</div>
	</div>

	{#if confirmError}
		<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{confirmError}</p>
	{/if}

	<div slot="actions" class="flex flex-wrap items-center justify-end gap-2">
		<AppButton variant="secondary" size="sm" on:click={() => (confirmOpen = false)} disabled={confirmBusy}>
			{t('panels.jwxt.confirm.cancel')}
		</AppButton>
		<AppButton variant="danger" size="sm" on:click={handleConfirm} loading={confirmBusy}>
			{t('panels.jwxt.confirm.pushConfirm')}
		</AppButton>
	</div>
</AppDialog>
