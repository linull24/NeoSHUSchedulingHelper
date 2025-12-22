<svelte:options runes={false} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import ContinuousPager from '$lib/components/ContinuousPager.svelte';
	import AsyncTaskProgress from '$lib/components/AsyncTaskProgress.svelte';
	import CourseFiltersToolbar from '$lib/components/CourseFiltersToolbar.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import CardBulkCheckbox from '$lib/components/CardBulkCheckbox.svelte';
	import CourseBulkBar from '$lib/components/CourseBulkBar.svelte';
	import AppListCard from '$lib/components/AppListCard.svelte';
	import JwxtRoundSelector from '$lib/components/JwxtRoundSelector.svelte';
	import JwxtUserscriptActions from '$lib/components/JwxtUserscriptActions.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
import AppButton from '$lib/primitives/AppButton.svelte';
import AppDialog from '$lib/primitives/AppDialog.svelte';
import AppPagination from '$lib/primitives/AppPagination.svelte';
import AppTextArea from '$lib/primitives/AppTextArea.svelte';
import { translator, type TranslateFn } from '$lib/i18n';
	import { getUserscriptConfig } from '../../config/userscript';
	import {
		jwxtPushPollingEnabled,
		jwxtPushPollingTaskId,
		rehydrateJwxtPushPollingTask,
		startJwxtPushPolling,
		stopJwxtPushPolling,
		updateJwxtPushPollingConcurrency
	} from '$lib/stores/jwxtPushPolling';
	import { JWXT_POLL_PUSH_CONCURRENCY } from '$lib/policies/jwxt/ioDock';
	import {
		jwxtRememberedUserId
	} from '$lib/stores/jwxt';
	import {
		clearJwxtCookieDeviceVault,
		hasStoredJwxtCookieDeviceVault,
		loadJwxtCookieFromDeviceVault,
		saveJwxtCookieToDeviceVault
	} from '$lib/stores/jwxtCookieDeviceVault';
	import {
		clearJwxtCookieVault,
		hasStoredJwxtCookieVault,
		loadJwxtCookieFromVault,
		saveJwxtCookieToVault
	} from '$lib/stores/jwxtCookieVault';
	import { activateHover, clearHover } from '$lib/stores/courseHover';
	import {
		deselectCourse,
		selectedCourseIds,
		wishlistCourseIds
	} from '$lib/stores/courseSelection';
	import { courseCatalog, courseCatalogMap, type CourseCatalogEntry } from '$lib/data/catalog/courseCatalog';
	import type { WeekDescriptor } from '$lib/data/InsaneCourseData';
	import {
		selectedEntryIds,
		termState,
		dispatchTermAction,
		dispatchTermActionWithEffects,
		ensureTermStateLoaded
	} from '$lib/stores/termStateStore';
	import { createCourseFilterStoreForScope, getFilterOptionsForScope, type CourseFilterState } from '$lib/stores/courseFilters';
	import { applyCourseFilters } from '$lib/utils/courseFilterEngine';
	import { paginationMode, pageNeighbors, pageSize } from '$lib/stores/paginationSettings';
	import { deriveGroupKey } from '$lib/data/termState/groupKey';
	import {
	jwxtGetStatus,
	jwxtGetRounds,
	jwxtPing,
	jwxtLogin,
	jwxtImportCookie,
		jwxtExportCookie,
		jwxtSelectRound,
		jwxtLogout,
		jwxtGetEnrollmentBreakdown,
		type JwxtStatus,
	type JwxtRoundInfo,
	type JwxtSelectedPair
} from '$lib/data/jwxt/jwxtApi';
import { getDatasetConfig } from '../../config/dataset';
	import { jwxtCrawlState, startJwxtCrawl, stopJwxtCrawl } from '$lib/stores/jwxtCrawlTask';
import { activateRoundSnapshot, fetchCloudRoundIndex, hasRoundSnapshot } from '$lib/data/catalog/cloudSnapshot';
import type { EnrollmentBatchLabel } from '../../../shared/jwxtCrawler/batchPolicy';
	import { ENROLLMENT_BATCH_ORDER, computeUserRankInterval, isUserImpossibleGivenCapacity } from '../../../shared/jwxtCrawler/batchPolicy';
import type { JwxtEnrollmentBreakdown } from '../../../shared/jwxtCrawler/enrollmentBreakdown';
import { globalJwxtPolicyRegistry } from '$lib/policies/jwxt';
import {
	classifyJwxtEnrollPolicyError,
	filterJwxtEnrollCoursesByPolicy,
	getJwxtBatchFilterMode,
	isJwxtBatchFilterModeAvailable,
	getJwxtEnrollButtonPolicyState,
	shouldPrefetchJwxtUserBatchForEnroll
} from '$lib/policies/jwxt/ui';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	const datasetTermId = getDatasetConfig().termId;
	const userscriptConfig = getUserscriptConfig();

	let status: JwxtStatus | null = null;
	let statusMessage = '';

	let userId = '';
	let password = '';
	let loginMethod: 'password' | 'cookie' = 'password';
	let cookieHeader = '';

	let persistMode: 'none' | 'device' | 'vault' = 'device';
	let vaultPassword = '';
	let vaultPasswordConfirm = '';
	let vaultUnlockPassword = '';
	let autoLoginAttempted = false;
	let autoLoginBusy = false;
	let cookieHasDeviceVault = false;
	let cookieHasPasswordVault = false;

	let loginBusy = false;
	let syncBusy = false;
	let pushBusy = false;
	let pushPreviewBusy = false;
	let lastSyncAt: Date | null = null;
	let lastPushAt: Date | null = null;
	let pushStatus = '';
	let pendingTtlMs: 0 | 120000 = 0;
	let lastRemoteDirtyDigest: string | null = null;

	let roundBusy = false;
	let roundStatus = '';
	let roundCloudStatus = '';
	let roundTermLabel = '';
	let availableRounds: JwxtRoundInfo[] = [];
	let selectedXkkzId = '';
	let crawlStageText = '';
	let crawlStatusText = '';

	$: crawlStageText = formatCrawlStage($jwxtCrawlState.stage);
	$: crawlStatusText =
		$jwxtCrawlState.message ||
		crawlStageText ||
		($jwxtCrawlState.running ? t('panels.jwxt.statuses.crawling') : '');

	let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
	let autoSyncEnabled = false;
	let autoSyncIntervalSec = 120;
	let autoPushEnabled = false;
	let minAcceptableBatchLabel: EnrollmentBatchLabel | null = null;
	let batchFilterMode: 'all' | 'eligible-or-unknown' | 'eligible-only' = 'eligible-or-unknown';

	let remoteSelected: JwxtSelectedPair[] = [];
	let remoteSelectedKeySet = new Set<string>();
	let enrollSelectedSchedule: Array<{
		courseId: string;
		day: number;
		startPeriod: number;
		endPeriod: number;
		weeks?: WeekDescriptor;
	}> = [];
	let scrollRoot: HTMLElement | null = null;

	const enrollFiltersBase = createCourseFilterStoreForScope('jwxt', { statusMode: 'all:no-status', conflictMode: 'time' });
	const enrollBaseCourses = courseCatalog.filter((entry) => Boolean(entry.courseCode && entry.sectionId));
	let enrollCurrentPage = 1;
	let enrollTotalPages = 1;
	let enrollContinuousActivePage = 1;
	let enrollLastMode: 'paged' | 'continuous' | null = null;
	let enrollContentSignature = '';

	let enrollBulkSelection = new Set<string>();
	let enrollBulkBusy = false;

	let dropBulkSelection = new Set<string>();
	let dropBulkBusy = false;

	let confirmOpen = false;
	let confirmTitle = '';
	let confirmBody = '';
	let confirmConfirmLabel = '';
	let confirmVariant: 'primary' | 'danger' = 'primary';
	let confirmBusy = false;
	let confirmError = '';
	let confirmAction: (() => Promise<void>) | null = null;
	let confirmSections: Array<{ title: string; items: string[] }> = [];
	let confirmKind: 'default' | 'jwxt-push' | 'jwxt-poll-push' = 'default';

	let pushPollEnrollConcurrency = JWXT_POLL_PUSH_CONCURRENCY.default;

	let breakdownOpen = false;
	let breakdownBusy = false;
	let breakdownError = '';
	let breakdownEntryLabel = '';
	let breakdown: JwxtEnrollmentBreakdown | null = null;
	let breakdownUserBatch: any = null;
	let breakdownCapacity: number | null = null;

	const inputClass =
		'w-full min-w-0 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]';

	$: userId = $jwxtRememberedUserId;
	$: autoSyncEnabled = $termState?.settings.jwxt.autoSyncEnabled ?? false;
	$: autoSyncIntervalSec = $termState?.settings.jwxt.autoSyncIntervalSec ?? 120;
	$: autoPushEnabled = $termState?.settings.jwxt.autoPushEnabled ?? false;
	$: minAcceptableBatchLabel = ($termState?.settings.jwxt.minAcceptableBatchLabel ?? null) as any;
	$: batchFilterMode = $termState ? (getJwxtBatchFilterMode($termState) as any) : 'eligible-or-unknown';
	$: cookieHasDeviceVault = hasStoredJwxtCookieDeviceVault();
	$: cookieHasPasswordVault = hasStoredJwxtCookieVault();
	$: if (browser) {
		if (persistMode === 'device' && !cookieHasDeviceVault && cookieHasPasswordVault) persistMode = 'vault';
		if (persistMode === 'vault' && !cookieHasPasswordVault && cookieHasDeviceVault) persistMode = 'device';
	}

	const format = (key: string, values?: Record<string, string | number>) => {
		let template = t(key);
		if (!values) return template;
		return Object.entries(values).reduce(
			(acc, [placeholder, value]) => acc.replace(`{${placeholder}}`, String(value)),
			template
		);
	};

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

	const jwxtIndex: Record<string, string> = Object.create(null);
	const jwxtIndexBySectionId: Record<string, string> = Object.create(null);
	for (const entry of courseCatalog) {
		jwxtIndex[`${entry.courseCode}::${entry.sectionId}`] = entry.id;
		if (!jwxtIndexBySectionId[entry.sectionId]) jwxtIndexBySectionId[entry.sectionId] = entry.id;
	}

	function mapRemotePairsToLocalIds(pairs: JwxtSelectedPair[]) {
		const ids: string[] = [];
		for (const pair of pairs) {
			const id = jwxtIndex[`${pair.kchId}::${pair.jxbId}`] || jwxtIndexBySectionId[pair.jxbId];
			if (id) ids.push(id);
		}
		return ids;
	}

	function mapRemotePairToLocalId(pair: { kchId: string; jxbId: string }) {
		return jwxtIndex[`${pair.kchId}::${pair.jxbId}`] || jwxtIndexBySectionId[pair.jxbId] || '';
	}

	function describeCourse(entry: CourseCatalogEntry) {
		const parts = [entry.title];
		if (entry.teacher) parts.push(entry.teacher);
		if (entry.slot) parts.push(entry.slot);
		const meta: string[] = [];
		if (entry.courseCode) meta.push(entry.courseCode);
		if (entry.sectionId) meta.push(entry.sectionId);
		if (meta.length) parts.push(meta.join(' · '));
		return parts.join(' · ');
	}

	function handleHover(entry: CourseCatalogEntry, source: 'candidate' | 'selected' | 'list') {
		activateHover({
			id: entry.id,
			title: entry.title,
			location: entry.location,
			slot: entry.slot,
			weekSpan: entry.weekSpan,
			weekParity: entry.weekParity,
			source
		});
	}

	function handleLeave(source: 'candidate' | 'selected' | 'list') {
		clearHover(source);
	}

	function setStatusMessage(key: string, params?: Record<string, string | number>) {
		statusMessage = params ? t(key, params) : t(key);
	}

	function renderApiError(error: unknown) {
		if (typeof error === 'string') return error;
		return error instanceof Error ? error.message : String(error);
	}

	function formatRoundOption(round: JwxtRoundInfo) {
		const parts: string[] = [];
		if (round.xklcmc) parts.push(round.xklcmc);
		else if (round.xklc) parts.push(t('panels.jwxt.rounds.roundIndex', { count: round.xklc }));
		if (round.kklxLabel) parts.push(round.kklxLabel);
		return parts.join(' · ') || round.xkkzId;
	}

	function formatCrawlStage(stage: string | null): string {
		if (!stage) return '';
		return t(`common.crawlStages.${stage}`);
	}

	async function updateJwxtSettings(patch: Partial<NonNullable<typeof $termState>['settings']['jwxt']>) {
		if (!$termState) return;
		const next = { ...$termState.settings.jwxt, ...patch };
		const result = await dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { jwxt: next } });
		if (!result.ok) {
			statusMessage = result.error.message;
		}
	}

	async function refreshRounds() {
		if (!browser) return;
		if (!status?.loggedIn) return;
		roundBusy = true;
		try {
			roundStatus = t('panels.jwxt.rounds.loading');
			roundCloudStatus = '';
			const res = await jwxtGetRounds();
			if (!res.ok) {
				availableRounds = [];
				roundTermLabel = '';
				selectedXkkzId = '';
				roundStatus = res.error;
				return;
			}
			availableRounds = res.rounds ?? [];
			const termParts = [res.term?.xkxnmc, res.term?.xkxqmc].filter(Boolean) as string[];
			roundTermLabel = termParts.join(' ') || '';
			const desired = (res.selectedXkkzId ?? res.activeXkkzId ?? '').trim();
			if (desired) selectedXkkzId = desired;
			else if (!selectedXkkzId && availableRounds.length) selectedXkkzId = availableRounds[0].xkkzId;
			roundStatus = '';
			void compareCloudRounds(res.rounds ?? []);
		} catch (error) {
			roundStatus = renderApiError(error);
		} finally {
			roundBusy = false;
		}
	}

	async function compareCloudRounds(rounds: JwxtRoundInfo[]) {
		if (!browser) return;
		if (!rounds.length) return;
		roundCloudStatus = t('panels.jwxt.rounds.cloudCompareLoading');
		const cloud = await fetchCloudRoundIndex(datasetTermId);
		if (!cloud.ok) {
			roundCloudStatus = t('panels.jwxt.rounds.cloudCompareFailed', { error: cloud.error });
			return;
		}
		const cloudByLc = new Map(cloud.rounds.map((r) => [r.xklc, r]));
		const important = rounds.filter((r) => r.xklc === '1' || r.xklc === '2');
		const targets = important.length ? important : rounds.slice(0, 2);
		const missing: string[] = [];
		const mismatched: string[] = [];
		for (const r of targets) {
			if (!r.xklc) continue;
			const cloudRound = cloudByLc.get(r.xklc);
			if (!cloudRound) missing.push(r.xklc);
			else if (cloudRound.xkkzId && cloudRound.xkkzId !== r.xkkzId) mismatched.push(r.xklc);
		}
		if (!missing.length && !mismatched.length) {
			roundCloudStatus = t('panels.jwxt.rounds.cloudCompareOk');
			return;
		}
		roundCloudStatus = t('panels.jwxt.rounds.cloudCompareMismatch', {
			missing: missing.join(','),
			mismatched: mismatched.join(',')
		});
	}

	async function handleSelectRound(next: string) {
		if (!browser) return;
		if (!next || next === selectedXkkzId) return;
		selectedXkkzId = next;
		roundBusy = true;
		try {
			roundStatus = '';
			const res = await jwxtSelectRound({ xkkzId: next });
			if (!res.ok) {
				roundStatus = res.error;
				return;
			}
			selectedXkkzId = res.selectedXkkzId || next;
			const label = formatRoundOption(
				availableRounds.find((r) => r.xkkzId === selectedXkkzId) ?? {
					xkkzId: selectedXkkzId,
					kklxdm: '',
					kklxLabel: '',
					active: false
				}
			);
			setStatusMessage('panels.jwxt.statuses.roundSelected', { round: label });
			if (hasRoundSnapshot(datasetTermId, selectedXkkzId)) {
				const activated = activateRoundSnapshot(datasetTermId, selectedXkkzId);
				if (activated.ok) setStatusMessage('panels.jwxt.statuses.roundSnapshotActivated', { round: label });
			}
			void handleSync({ silent: true });
		} catch (error) {
			roundStatus = renderApiError(error);
		} finally {
			roundBusy = false;
		}
	}

	async function handleCrawlData() {
		if (!browser) return;
		try {
			setStatusMessage('panels.jwxt.statuses.crawling');
			const res = await startJwxtCrawl(datasetTermId);
			if (!res.ok) {
				if (res.error === 'CANCELED') {
					setStatusMessage('panels.jwxt.statuses.crawlCanceled');
					return;
				}
				setStatusMessage('panels.jwxt.statuses.crawlFailed', { error: res.error });
				return;
			}
			setStatusMessage('panels.jwxt.statuses.crawlSuccess');
		} finally {
			// progress state is tracked via jwxtCrawlState
		}
	}

	async function handleStopCrawl() {
		const res = await stopJwxtCrawl();
		if (!res.ok) setStatusMessage('panels.jwxt.statuses.crawlFailed', { error: res.error });
		else setStatusMessage('panels.jwxt.statuses.crawlCanceled');
	}

	async function persistCurrentSession(): Promise<'saved' | 'skipped' | 'none'> {
		if (!browser) return 'none';
		if (persistMode === 'none') return 'none';
		const exported = await jwxtExportCookie();
		if (!exported.ok) {
			// SSG/userscript runtime: the browser cookie jar already persists the session for jwxt.shu.edu.cn,
			// and we cannot safely export HttpOnly cookies from the frontend. Treat as "nothing to persist".
			if (exported.error === 'EXPORT_COOKIE_UNSUPPORTED_FRONTEND') return 'skipped';
			throw new Error(exported.error);
		}

		if (persistMode === 'device') {
			await saveJwxtCookieToDeviceVault(exported.cookie);
			return 'saved';
		}

		if (!vaultPassword || vaultPassword.length < 6) {
			throw new Error(t('panels.jwxt.statuses.vaultPasswordTooShort'));
		}
		if (vaultPassword !== vaultPasswordConfirm) {
			throw new Error(t('panels.jwxt.statuses.vaultPasswordMismatch'));
		}
		await saveJwxtCookieToVault(exported.cookie, vaultPassword);
		return 'saved';
	}

	async function saveSessionNow() {
		if (!browser) return;
		loginBusy = true;
		try {
			const res = await persistCurrentSession();
			if (res === 'saved' && persistMode !== 'none') setStatusMessage('panels.jwxt.statuses.persistSaved');
		} catch (error) {
			setStatusMessage('panels.jwxt.statuses.persistFailed', { error: renderApiError(error) });
		} finally {
			loginBusy = false;
		}
	}

	async function tryAutoLogin() {
		if (!browser) return;
		if (autoLoginAttempted) return;
		autoLoginAttempted = true;
		if (!hasStoredJwxtCookieDeviceVault()) return;
		const uid = $jwxtRememberedUserId.trim();
		if (!uid) return;
		autoLoginBusy = true;
		try {
			setStatusMessage('panels.jwxt.statuses.autoLoginTrying');
			let cookie = '';
			try {
				cookie = await loadJwxtCookieFromDeviceVault();
			} catch (error) {
				clearJwxtCookieDeviceVault();
				throw error;
			}
			const imported = await jwxtImportCookie({ userId: uid, cookie });
			if (!imported.ok) {
				if (imported.error.includes('Cookie invalid')) clearJwxtCookieDeviceVault();
				setStatusMessage('panels.jwxt.statuses.autoLoginFailed', { error: imported.error });
				return;
			}
			status = imported;
			if (status.loggedIn) {
				setStatusMessage('panels.jwxt.statuses.autoLoginSuccess');
				void refreshRounds();
				void handleSync({ silent: true });
			}
		} catch (error) {
			setStatusMessage('panels.jwxt.statuses.autoLoginFailed', { error: renderApiError(error) });
		} finally {
			autoLoginBusy = false;
		}
	}

	async function unlockVaultAndImport() {
		if (!browser) return;
		if (!$jwxtRememberedUserId.trim()) {
			setStatusMessage('panels.jwxt.statuses.missingUserId');
			return;
		}
		if (!vaultUnlockPassword) {
			setStatusMessage('panels.jwxt.statuses.missingVaultPassword');
			return;
		}
		loginBusy = true;
		try {
			const cookie = await loadJwxtCookieFromVault(vaultUnlockPassword);
			const imported = await jwxtImportCookie({ userId: $jwxtRememberedUserId.trim(), cookie });
			if (!imported.ok) {
				setStatusMessage('panels.jwxt.statuses.loginFailed', { error: imported.error });
				return;
			}
			status = imported;
			vaultUnlockPassword = '';
			setStatusMessage('panels.jwxt.statuses.loginSuccess');
			void refreshRounds();
			void handleSync();
		} catch (error) {
			setStatusMessage('panels.jwxt.statuses.loginFailed', { error: renderApiError(error) });
		} finally {
			loginBusy = false;
		}
	}

	async function importCookieHeader() {
		if (!browser) return;
		if (!$jwxtRememberedUserId.trim() || !cookieHeader.trim()) {
			setStatusMessage('panels.jwxt.statuses.missingCookieCredentials');
			return;
		}
		loginBusy = true;
		try {
			setStatusMessage('panels.jwxt.statuses.importingCookie');
			const imported = await jwxtImportCookie({ userId: $jwxtRememberedUserId.trim(), cookie: cookieHeader.trim() });
			if (!imported.ok) {
				setStatusMessage('panels.jwxt.statuses.loginFailed', { error: imported.error });
				return;
			}
			status = imported;
			cookieHeader = '';
			setStatusMessage('panels.jwxt.statuses.loginSuccess');
			try {
				await persistCurrentSession();
				if (persistMode !== 'none') setStatusMessage('panels.jwxt.statuses.persistSaved');
			} catch (error) {
				setStatusMessage('panels.jwxt.statuses.persistFailed', { error: renderApiError(error) });
			}
			void refreshRounds();
			void handleSync();
		} finally {
			loginBusy = false;
		}
	}

	async function openBreakdown(entry: CourseCatalogEntry) {
		if (!entry.courseCode || !entry.sectionId) return;
		breakdownOpen = true;
		breakdownBusy = true;
		breakdownError = '';
		breakdown = null;
		breakdownUserBatch = null;
		breakdownCapacity = Number.isFinite(entry.capacity) ? entry.capacity : null;
		breakdownEntryLabel = describeCourse(entry);
		try {
			const res = await jwxtGetEnrollmentBreakdown({ kchId: entry.courseCode, jxbId: entry.sectionId });
			if (!res.ok) throw new Error(res.error);
			breakdown = res.breakdown ?? null;
			breakdownUserBatch = res.userBatch ?? null;
			if (res.userBatch) {
				const { source, ...userBatch } = res.userBatch as any;
				const interval = breakdown && breakdownCapacity != null ? computeUserRankInterval({ breakdown, capacity: breakdownCapacity }) : null;
				const impossible = breakdown && breakdownCapacity != null ? isUserImpossibleGivenCapacity({ breakdown, capacity: breakdownCapacity }).impossible : false;
				await dispatchTermAction({
					type: 'JWXT_USERBATCH_CACHE_SET',
					pair: { kchId: entry.courseCode, jxbId: entry.sectionId },
					userBatch,
					source
					,
					impossible,
					capacity: breakdownCapacity,
					rankStart: interval?.start,
					rankEnd: interval?.end
				});
			}
		} catch (error) {
			breakdownError = renderApiError(error);
		} finally {
			breakdownBusy = false;
		}
	}

	function confirmRemoteDrop(pair: { kchId: string; jxbId: string; label: string }) {
		requestConfirm({
			title: t('panels.jwxt.confirm.dropTitle'),
			body: format('panels.jwxt.confirm.dropBody', { course: pair.label }),
			confirmLabel: t('panels.jwxt.confirm.dropConfirm'),
			variant: 'danger',
			action: async () => {
				const result = await dispatchTermAction({ type: 'JWXT_DROP_NOW', pair: { kchId: pair.kchId, jxbId: pair.jxbId } });
				if (!result.ok) throw new Error(result.error.message);
				setStatusMessage('panels.jwxt.statuses.dropSuccess');
			}
		});
	}

	function confirmRemoteEnroll(entry: CourseCatalogEntry) {
		if (!entry.courseCode || !entry.sectionId) return;
		const meta = enrollFilterResult.meta.get(entry.id);
		if (meta?.conflict === 'time-conflict') return;
		const key = `${entry.courseCode}::${entry.sectionId}`;
		if (remoteSelectedKeySet.has(key)) return;
		requestConfirm({
			title: t('panels.jwxt.confirm.enrollTitle'),
			body: format('panels.jwxt.confirm.enrollBody', { course: describeCourse(entry) }),
			confirmLabel: t('panels.jwxt.confirm.enrollConfirm'),
			variant: 'danger',
			action: async () => {
				if ($termState && shouldPrefetchJwxtUserBatchForEnroll($termState, { kchId: entry.courseCode!, jxbId: entry.sectionId! })) {
					const breakdownRes = await jwxtGetEnrollmentBreakdown({ kchId: entry.courseCode, jxbId: entry.sectionId });
					if (!breakdownRes.ok) throw new Error(breakdownRes.error);
					if (breakdownRes.userBatch) {
						const { source, ...userBatch } = breakdownRes.userBatch as any;
						const cacheResult = await dispatchTermAction({
							type: 'JWXT_USERBATCH_CACHE_SET',
							pair: { kchId: entry.courseCode, jxbId: entry.sectionId },
							userBatch,
							source
						});
						if (!cacheResult.ok) throw new Error(cacheResult.error.message);
					}
				}

				const result = await dispatchTermAction({
					type: 'JWXT_ENROLL_NOW',
					pair: { kchId: entry.courseCode, jxbId: entry.sectionId },
					xkkzId: selectedXkkzId || undefined
				});
					if (!result.ok) {
						const message = result.error.message;
						const kind = classifyJwxtEnrollPolicyError(message);
						if (kind === 'USER_BATCH_MISSING') throw new Error(t('panels.jwxt.batchPolicyNeedUserBatch'));
						if (kind === 'USER_BATCH_UNAVAILABLE') throw new Error(t('panels.jwxt.batchPolicyUnavailable'));
						if (kind === 'IMPOSSIBLE') throw new Error(t('panels.jwxt.batchPolicyImpossible'));
						if (kind === 'BELOW_MIN') throw new Error(t('panels.jwxt.batchPolicyDenied', { min: minAcceptableBatchLabel ?? '-' }));
						throw new Error(message);
					}
				setStatusMessage('panels.jwxt.statuses.enrollSuccess');
				void handleSync({ silent: true });
			}
		});
	}

	function isEnrollEligible(entry: CourseCatalogEntry) {
		if (!entry.courseCode || !entry.sectionId) return false;
		const meta = enrollFilterResult.meta.get(entry.id);
		if (meta?.conflict === 'time-conflict') return false;
		if (remoteSelectedKeySet.has(`${entry.courseCode}::${entry.sectionId}`)) return false;
		if ($termState) {
			const policyState = getJwxtEnrollButtonPolicyState($termState, { kchId: entry.courseCode, jxbId: entry.sectionId });
			if (!policyState.enabled) return false;
		}
		return true;
	}

	$: breakdownInterval =
		breakdown && breakdownUserBatch?.kind === 'available'
			? computeUserRankInterval({ breakdown, capacity: breakdownCapacity })
			: null;

	function enrollBulkToggle(entryId: string) {
		const next = new Set(enrollBulkSelection);
		if (next.has(entryId)) next.delete(entryId);
		else next.add(entryId);
		enrollBulkSelection = next;
	}

	function enrollBulkClear() {
		enrollBulkSelection = new Set<string>();
	}

	function enrollBulkSelectVisible() {
		const next = new Set(enrollBulkSelection);
		for (const entry of enrollVisibleCourses) {
			if (!isEnrollEligible(entry)) continue;
			next.add(entry.id);
		}
		enrollBulkSelection = next;
	}

	function confirmBulkEnroll(entryIds: string[]) {
		const selected = entryIds
			.map((id) => courseCatalogMap.get(id))
			.filter(Boolean) as CourseCatalogEntry[];

		const eligible = selected.filter(isEnrollEligible);
		const skipped = selected.length - eligible.length;

		if (eligible.length === 0) {
			setStatusMessage('panels.jwxt.statuses.bulkNothingToEnroll');
			return;
		}

		const enrollList = limitList(eligible.map(describeCourse));
		const sections: Array<{ title: string; items: string[] }> = [
			{
				title: t('panels.jwxt.confirm.bulkEnrollListTitle'),
				items:
					enrollList.more > 0
						? [...enrollList.items, format('panels.jwxt.confirm.pushDiffMore', { count: enrollList.more })]
						: enrollList.items
			}
		];
		if (skipped > 0) {
			sections.push({
				title: t('panels.jwxt.confirm.bulkSkipTitle'),
				items: [format('panels.jwxt.confirm.bulkSkipCount', { count: skipped })]
			});
		}

		requestConfirm({
			title: t('panels.jwxt.confirm.bulkEnrollTitle'),
			body: format('panels.jwxt.confirm.bulkEnrollBody', { count: eligible.length, skipped }),
			confirmLabel: t('panels.jwxt.confirm.bulkEnrollConfirm'),
			variant: 'danger',
			sections,
			action: async () => {
				enrollBulkBusy = true;
				try {
					for (const entry of eligible) {
						if ($termState && shouldPrefetchJwxtUserBatchForEnroll($termState, { kchId: entry.courseCode!, jxbId: entry.sectionId! })) {
							const breakdownRes = await jwxtGetEnrollmentBreakdown({ kchId: entry.courseCode!, jxbId: entry.sectionId! });
							if (!breakdownRes.ok) throw new Error(breakdownRes.error);
							if (breakdownRes.userBatch) {
								const { source, ...userBatch } = breakdownRes.userBatch as any;
								const cacheResult = await dispatchTermAction({
									type: 'JWXT_USERBATCH_CACHE_SET',
									pair: { kchId: entry.courseCode!, jxbId: entry.sectionId! },
									userBatch,
									source
								});
								if (!cacheResult.ok) throw new Error(cacheResult.error.message);
							}
						}
						const result = await dispatchTermAction({
							type: 'JWXT_ENROLL_NOW',
							pair: { kchId: entry.courseCode!, jxbId: entry.sectionId! },
							xkkzId: selectedXkkzId || undefined
						});
						if (!result.ok) {
							const message = result.error.message;
							const kind = classifyJwxtEnrollPolicyError(message);
							if (kind === 'USER_BATCH_MISSING') throw new Error(t('panels.jwxt.batchPolicyNeedUserBatch'));
							if (kind === 'USER_BATCH_UNAVAILABLE') throw new Error(t('panels.jwxt.batchPolicyUnavailable'));
							if (kind === 'IMPOSSIBLE') throw new Error(t('panels.jwxt.batchPolicyImpossible'));
							if (kind === 'BELOW_MIN') {
								throw new Error(t('panels.jwxt.batchPolicyDenied', { min: minAcceptableBatchLabel ?? '-' }));
							}
							throw new Error(message);
						}
					}
					enrollBulkClear();
					setStatusMessage('panels.jwxt.statuses.bulkEnrollSuccess', { count: eligible.length });
					void handleSync({ silent: true });
				} finally {
					enrollBulkBusy = false;
				}
			}
		});
	}

	function dropBulkToggle(key: string) {
		const next = new Set(dropBulkSelection);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		dropBulkSelection = next;
	}

	function dropBulkClear() {
		dropBulkSelection = new Set<string>();
	}

	function dropBulkSelectAll() {
		dropBulkSelection = new Set(remoteSelected.map((pair) => `${pair.kchId}::${pair.jxbId}`));
	}

	function confirmBulkDrop(keys: string[]) {
		const keySet = new Set(keys);
		const selectedPairs = remoteSelected.filter((pair) => keySet.has(`${pair.kchId}::${pair.jxbId}`));
		if (selectedPairs.length === 0) {
			setStatusMessage('panels.jwxt.statuses.bulkNothingToDrop');
			return;
		}

		const labels = selectedPairs.map((pair) => {
			const localId = mapRemotePairToLocalId(pair);
			const entry = localId ? courseCatalogMap.get(localId) : null;
			return entry ? describeCourse(entry) : `${pair.kchId} (${pair.jxbId})`;
		});
		const dropList = limitList(labels);

		requestConfirm({
			title: t('panels.jwxt.confirm.bulkDropTitle'),
			body: format('panels.jwxt.confirm.bulkDropBody', { count: selectedPairs.length }),
			confirmLabel: t('panels.jwxt.confirm.bulkDropConfirm'),
			variant: 'danger',
			sections: [
				{
					title: t('panels.jwxt.confirm.bulkDropListTitle'),
					items:
						dropList.more > 0
							? [...dropList.items, format('panels.jwxt.confirm.pushDiffMore', { count: dropList.more })]
							: dropList.items
				}
			],
			action: async () => {
				dropBulkBusy = true;
				try {
					for (const pair of selectedPairs) {
						const result = await dispatchTermAction({ type: 'JWXT_DROP_NOW', pair: { kchId: pair.kchId, jxbId: pair.jxbId } });
						if (!result.ok) throw new Error(result.error.message);
					}
					dropBulkClear();
					setStatusMessage('panels.jwxt.statuses.bulkDropSuccess', { count: selectedPairs.length });
					void handleSync({ silent: true });
				} finally {
					dropBulkBusy = false;
				}
			}
		});
	}

	async function copyRemoteToWishlist(entry: CourseCatalogEntry) {
		const state = get(termState);
		if (!state) return;

		const granularity = state.settings.granularity.candidates ?? 'groupPreferred';
		const groupKey = deriveGroupKey(entry);
		const action =
			granularity === 'groupPreferred'
				? { type: 'SEL_PROMOTE_GROUP', groupKey: groupKey as any, to: 'wishlist' }
				: { type: 'SEL_PROMOTE_SECTION', entryId: entry.id as any, to: 'wishlist' };

		const result = await dispatchTermAction(action as any);
		if (!result.ok && result.error.kind === 'DUPLICATE_SELECTED_GROUP') {
			const fallback = await dispatchTermAction({
				type: 'SEL_PROMOTE_GROUP',
				groupKey: groupKey as any,
				to: 'wishlist'
			});
			if (!fallback.ok) {
				statusMessage = fallback.error.message;
				return;
			}
			setStatusMessage('panels.jwxt.statuses.copyToWishlistSuccess');
			return;
		}
		if (!result.ok) {
			statusMessage = result.error.message;
			return;
		}
		setStatusMessage('panels.jwxt.statuses.copyToWishlistSuccess');
	}

	async function refreshStatus() {
		const response = await jwxtGetStatus();
		if (!response.ok) {
			status = {
				supported: false,
				loggedIn: false,
				message: response.error
			};
			setStatusMessage('panels.jwxt.statuses.statusFailed', { error: response.error });
			return;
		}
		status = response;
		if (!response.supported) {
			setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		setStatusMessage(response.loggedIn ? 'panels.jwxt.statuses.loggedIn' : 'panels.jwxt.statuses.loggedOut');
		if (response.loggedIn) {
			void refreshRounds();
		} else {
			availableRounds = [];
			roundTermLabel = '';
			selectedXkkzId = '';
			roundStatus = '';
		}
	}

	async function handlePing() {
		try {
			setStatusMessage('panels.jwxt.statuses.pinging');
			const response = await jwxtPing();
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.pingFailed', { error: response.error });
				return;
			}
			setStatusMessage('panels.jwxt.statuses.pingOk', { status: response.ssoEntryStatus });
		} catch (error) {
			setStatusMessage('panels.jwxt.statuses.pingFailed', { error: renderApiError(error) });
		}
	}

	onMount(() => {
		void ensureTermStateLoaded();
		void refreshStatus().then(() => void tryAutoLogin());
		void rehydrateJwxtPushPollingTask();
		return;
	});

	onDestroy(() => {
		if (autoSyncTimer) {
			clearInterval(autoSyncTimer);
			autoSyncTimer = null;
		}
	});

	function stopAutoSyncTimer() {
		if (autoSyncTimer) {
			clearInterval(autoSyncTimer);
			autoSyncTimer = null;
		}
	}

	function startAutoSyncTimer(intervalSec: number) {
		stopAutoSyncTimer();
		autoSyncTimer = setInterval(() => {
			void handleSync({ silent: true });
		}, Math.max(30, intervalSec) * 1000);
	}

	$: if (browser) {
		if (autoSyncEnabled && status?.loggedIn && status?.supported) {
			startAutoSyncTimer(autoSyncIntervalSec);
		} else {
			stopAutoSyncTimer();
		}
	}

		async function handleLogin() {
		if (!userId.trim() || !password) {
			setStatusMessage('panels.jwxt.statuses.missingCredentials');
			return;
		}
		try {
			loginBusy = true;
			setStatusMessage('panels.jwxt.statuses.loggingIn');
			const response = await jwxtLogin({ userId: userId.trim(), password });
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.loginFailed', { error: response.error });
				return;
			}
			status = response;
			password = '';
			setStatusMessage('panels.jwxt.statuses.loginSuccess');
			try {
				const res = await persistCurrentSession();
				if (res === 'saved' && persistMode !== 'none') setStatusMessage('panels.jwxt.statuses.persistSaved');
			} catch (error) {
				setStatusMessage('panels.jwxt.statuses.persistFailed', { error: renderApiError(error) });
			}
			void refreshRounds();
			void handleSync();
		} finally {
			loginBusy = false;
		}
	}

	async function handleLogout() {
		try {
			loginBusy = true;
			const response = await jwxtLogout();
			if (!response.ok) {
				setStatusMessage('panels.jwxt.statuses.logoutFailed', { error: response.error });
				return;
			}
			status = response;
			setStatusMessage('panels.jwxt.statuses.loggedOut');
			remoteSelected = [];
		} finally {
			loginBusy = false;
		}
	}

	async function handleSync(options?: { silent?: boolean }) {
		if (!status?.supported) {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.requireLogin');
			return;
		}
		syncBusy = true;
		try {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncing');
			const beforeLen = get(termState)?.history?.entries?.length ?? 0;
			const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'JWXT_PULL_REMOTE' });
			const dispatched = await result;
			if (!dispatched.ok) {
				if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncFailed', { error: dispatched.error.message });
				return;
			}
			await effectsDone;
			const pullErr = readHistoryErrorSince({ beforeLen, prefix: 'jwxt:pull-err:' });
			if (pullErr) {
				if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncFailed', { error: pullErr });
				return;
			}
			lastSyncAt = new Date();
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncSuccess', { selected: 0, wishlist: 0 });
		} catch (error) {
			if (!options?.silent) setStatusMessage('panels.jwxt.statuses.syncFailed', { error: renderApiError(error) });
		} finally {
			syncBusy = false;
		}
	}

	function requestConfirm(config: {
		title: string;
		body: string;
		confirmLabel: string;
		variant?: 'primary' | 'danger';
		sections?: Array<{ title: string; items: string[] }>;
		kind?: 'default' | 'jwxt-push' | 'jwxt-poll-push';
		action: () => Promise<void>;
	}) {
		confirmTitle = config.title;
		confirmBody = config.body;
		confirmConfirmLabel = config.confirmLabel;
		confirmVariant = config.variant ?? 'primary';
		confirmSections = config.sections ?? [];
		confirmKind = config.kind ?? 'default';
		confirmAction = config.action;
		confirmError = '';
		confirmOpen = true;
	}

	async function runConfirmedAction() {
		if (!confirmAction) return;
		try {
			confirmBusy = true;
			await confirmAction();
			confirmOpen = false;
			confirmAction = null;
		} catch (error) {
			confirmError = renderApiError(error);
		} finally {
			confirmBusy = false;
		}
	}

	function limitList(items: string[], max = 20) {
		if (items.length <= max) return { items, more: 0 };
		return { items: items.slice(0, max), more: items.length - max };
	}

	function buildSelectedPairs() {
		const ids = Array.from(get(selectedEntryIds));
		return ids
			.map((id) => courseCatalogMap.get(id))
			.filter(Boolean)
			.map((entry) => ({ kchId: entry!.courseCode, jxbId: entry!.sectionId })) as JwxtSelectedPair[];
	}

	function computeDiff(remote: JwxtSelectedPair[], desired: JwxtSelectedPair[]) {
		const key = (pair: JwxtSelectedPair) => `${pair.kchId}::${pair.jxbId}`;
		const remoteSet = new Set(remote.map(key));
		const desiredSet = new Set(desired.map(key));
		return {
			toEnroll: desired.filter((pair) => !remoteSet.has(key(pair))),
			toDrop: remote.filter((pair) => !desiredSet.has(key(pair)))
		};
	}

	function describePair(pair: JwxtSelectedPair) {
		const id = mapRemotePairToLocalId(pair);
		const entry = id ? courseCatalogMap.get(id) : null;
		if (!entry) return `${pair.kchId} · ${pair.jxbId}`;
		return describeCourse(entry);
	}

	async function handlePreviewClick() {
		if (!status?.supported) {
			setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			setStatusMessage('panels.jwxt.statuses.requireLogin');
			return;
		}

		const snapshot = get(termState);
		const remote = snapshot?.jwxt.remoteSnapshot?.pairs ?? [];
		const desired = buildSelectedPairs();
		const diff = computeDiff(remote, desired);
		const enroll = diff.toEnroll.map(describePair);
		const drop = diff.toDrop.map(describePair);
		const enrollLimited = limitList(enroll);
		const dropLimited = limitList(drop);
		const enrollItems =
			enrollLimited.more > 0
				? [...enrollLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: enrollLimited.more })]
				: enrollLimited.items;
		const dropItems =
			dropLimited.more > 0
				? [...dropLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: dropLimited.more })]
				: dropLimited.items;
		pendingTtlMs = 0;
		requestConfirm({
			title: t('panels.jwxt.confirm.pushTitle'),
			body: format('panels.jwxt.confirm.pushPreviewBody', {
				enroll: diff.toEnroll.length,
				drop: diff.toDrop.length
			}),
			confirmLabel: t('panels.jwxt.confirm.pushConfirm'),
			variant: diff.toEnroll.length || diff.toDrop.length ? 'danger' : 'primary',
			kind: 'jwxt-push',
			sections: [
				{ title: t('panels.jwxt.confirm.pushDiffEnrollTitle'), items: enrollItems },
				{ title: t('panels.jwxt.confirm.pushDiffDropTitle'), items: dropItems }
			],
			action: async () => {
				pushBusy = true;
				try {
					const preview = await dispatchTermAction({ type: 'JWXT_PREVIEW_PUSH', ttlMs: pendingTtlMs });
					if (!preview.ok) throw new Error(preview.error.message);
					const beforeLen = get(termState)?.history?.entries?.length ?? 0;
					const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'JWXT_CONFIRM_PUSH' });
					const pushed = await result;
					if (!pushed.ok) throw new Error(pushed.error.message);
					await effectsDone;
					const pushErr = readHistoryErrorSince({ beforeLen, prefix: 'jwxt:push-err:' });
					if (pushErr) throw new Error(pushErr);
					if (hasHistoryEntrySince({ beforeLen, prefix: 'jwxt:frozen:push:' })) throw new Error('PUSH_PARTIAL_FAILURE');
					lastPushAt = new Date();
					setStatusMessage('panels.jwxt.statuses.pushing');
				} finally {
					pushBusy = false;
				}
			}
		});
	}

		async function handleStartPushPolling() {
		if (!status?.supported) {
			setStatusMessage('panels.jwxt.statuses.backendMissing');
			return;
		}
		if (!status.loggedIn) {
			setStatusMessage('panels.jwxt.statuses.requireLogin');
			return;
		}

		const snapshot = get(termState);
		const remote = snapshot?.jwxt.remoteSnapshot?.pairs ?? [];
		const desired = buildSelectedPairs();
		const diff = computeDiff(remote, desired);
		const enroll = diff.toEnroll.map(describePair);
		const drop = diff.toDrop.map(describePair);
		const enrollLimited = limitList(enroll);
		const dropLimited = limitList(drop);
		const enrollItems =
			enrollLimited.more > 0
				? [...enrollLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: enrollLimited.more })]
				: enrollLimited.items;
		const dropItems =
			dropLimited.more > 0
				? [...dropLimited.items, format('panels.jwxt.confirm.pushDiffMore', { count: dropLimited.more })]
				: dropLimited.items;

			requestConfirm({
				title: t('panels.jwxt.pollPush.confirmTitle'),
			body: format('panels.jwxt.confirm.pushPreviewBody', {
				enroll: diff.toEnroll.length,
				drop: diff.toDrop.length
			}),
			confirmLabel: t('panels.jwxt.pollPush.confirmStart'),
			variant: diff.toDrop.length ? 'danger' : 'primary',
			kind: 'jwxt-poll-push',
			sections: [
				{ title: t('panels.jwxt.confirm.pushDiffEnrollTitle'), items: enrollItems },
				{ title: t('panels.jwxt.confirm.pushDiffDropTitle'), items: dropItems }
			],
				action: async () => {
					const started = await startJwxtPushPolling({ enrollConcurrency: pushPollEnrollConcurrency });
					if (!started.ok) throw new Error((started as any).error || 'Failed to start');
					setStatusMessage('panels.jwxt.pollPush.started');
				}
			});
		}

	async function handleConfirmPush() {
		const result = await dispatchTermAction({ type: 'JWXT_CONFIRM_PUSH' });
		if (!result.ok) {
			setStatusMessage('panels.jwxt.statuses.pushFailed', { error: result.error.message });
			return;
		}
		lastPushAt = new Date();
		setStatusMessage('panels.jwxt.statuses.pushing');
	}

	$: {
		const snapshot = $termState;
		remoteSelected = (snapshot?.jwxt.remoteSnapshot?.pairs ?? []) as JwxtSelectedPair[];
		remoteSelectedKeySet = new Set(remoteSelected.map((pair) => `${pair.kchId}::${pair.jxbId}`));
		const scheduleIds = new Set<string>([...$selectedCourseIds, ...mapRemotePairsToLocalIds(remoteSelected)]);
		enrollSelectedSchedule = Array.from(scheduleIds).flatMap((id) => {
			const entry = courseCatalogMap.get(id);
			if (!entry) return [];
			return entry.timeChunks.map((chunk) => ({
				courseId: id,
				day: chunk.day,
				startPeriod: chunk.startPeriod,
				endPeriod: chunk.endPeriod,
				weeks: chunk.weeks
			}));
		});
		const digest = snapshot?.jwxt.remoteSnapshot?.digest ?? null;
		if (snapshot?.jwxt.syncState === 'REMOTE_DIRTY' && digest && digest !== lastRemoteDirtyDigest) {
			lastRemoteDirtyDigest = digest;
			requestConfirm({
				title: t('panels.jwxt.confirm.pushTitle'),
				body: t('panels.jwxt.confirm.remoteChangedBody'),
				confirmLabel: t('panels.jwxt.confirm.pushConfirm'),
				variant: 'danger',
				kind: 'jwxt-push',
				sections: [
					{
						title: t('panels.jwxt.confirm.pushDiffEnrollTitle'),
						items: (snapshot.jwxt.pushTicket?.diff.toEnroll ?? []).map(describePair)
					},
					{
						title: t('panels.jwxt.confirm.pushDiffDropTitle'),
						items: (snapshot.jwxt.pushTicket?.diff.toDrop ?? []).map(describePair)
					}
				],
				action: async () => {
					pushBusy = true;
					try {
						const preview = await dispatchTermAction({ type: 'JWXT_PREVIEW_PUSH', ttlMs: pendingTtlMs });
						if (!preview.ok) throw new Error(preview.error.message);
						const beforeLen = get(termState)?.history?.entries?.length ?? 0;
						const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'JWXT_CONFIRM_PUSH' });
						const pushed = await result;
						if (!pushed.ok) throw new Error(pushed.error.message);
						await effectsDone;
						const pushErr = readHistoryErrorSince({ beforeLen, prefix: 'jwxt:push-err:' });
						if (pushErr) throw new Error(pushErr);
						if (hasHistoryEntrySince({ beforeLen, prefix: 'jwxt:frozen:push:' })) throw new Error('PUSH_PARTIAL_FAILURE');
						lastPushAt = new Date();
						setStatusMessage('panels.jwxt.statuses.pushing');
					} finally {
						pushBusy = false;
					}
				}
			});
		}
	}

	$: enrollPageSizeValue = Math.max(1, $pageSize || 1);
	$: enrollEffectiveFilterState = $enrollFiltersBase;
	$: enrollFilterResult = applyCourseFilters(enrollBaseCourses, enrollEffectiveFilterState, {
		selectedIds: $selectedCourseIds,
		wishlistIds: $wishlistCourseIds,
		selectedSchedule: enrollSelectedSchedule,
		filterScope: 'jwxt',
		termState: $termState
	});
	$: enrollCourses = $termState ? (filterJwxtEnrollCoursesByPolicy($termState, enrollFilterResult.items) as any) : enrollFilterResult.items;
	$: enrollTotalItems = enrollCourses.length;
	$: enrollTotalPages = Math.max(1, Math.ceil(Math.max(1, enrollTotalItems) / enrollPageSizeValue));
	$: showEnrollPaginationFooter = $paginationMode === 'paged' && enrollTotalPages > 1;
	$: enrollBulkSelectLabel =
		$paginationMode === 'paged' && enrollTotalPages > 1
			? t('panels.jwxt.bulk.selectVisible')
			: t('panels.jwxt.bulk.selectEligible');

	$: {
		const sig = `${enrollTotalItems}`;
		if (sig !== enrollContentSignature) {
			enrollContentSignature = sig;
			enrollCurrentPage = 1;
			enrollContinuousActivePage = 1;
		}
	}

	$: if ($paginationMode !== enrollLastMode) {
		if ($paginationMode === 'continuous')
			enrollContinuousActivePage = Math.max(1, Math.min(enrollTotalPages, enrollCurrentPage));
		else enrollCurrentPage = Math.max(1, Math.min(enrollTotalPages, enrollContinuousActivePage));
		enrollLastMode = $paginationMode;
	}

	$: enrollCurrentPage = Math.min(enrollCurrentPage, enrollTotalPages);
	$: enrollContinuousActivePage = Math.max(1, Math.min(enrollTotalPages, enrollContinuousActivePage));
	$: enrollEffectiveNeighbors = Math.max(0, Math.floor($pageNeighbors ?? 0));
	$: enrollWindowPageMin =
		$paginationMode === 'paged' ? enrollCurrentPage : Math.max(1, enrollContinuousActivePage - enrollEffectiveNeighbors);
	$: enrollWindowPageMax =
		$paginationMode === 'paged'
			? enrollCurrentPage
			: Math.min(enrollTotalPages, enrollContinuousActivePage + enrollEffectiveNeighbors);
	$: enrollWindowStartIndex = (enrollWindowPageMin - 1) * enrollPageSizeValue;
	$: enrollWindowEndIndex = Math.min(enrollTotalItems, enrollWindowPageMax * enrollPageSizeValue);
	$: enrollVisibleCourses =
		enrollCourses.slice(
			enrollWindowStartIndex,
			$paginationMode === 'paged' ? enrollWindowStartIndex + enrollPageSizeValue : enrollWindowEndIndex
		);

	function handleEnrollPageChange(page: number) {
		enrollCurrentPage = Math.max(1, Math.min(enrollTotalPages, page));
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.jwxt.title')}
		subtitle={t('panels.jwxt.subtitle')}
		density="comfortable"
		bind:scrollRoot
	>
		<div class="flex flex-wrap items-start gap-5 min-w-0">
			<AppControlPanel
				title={t('panels.jwxt.connectionTitle')}
				description={t('panels.jwxt.connectionDescription')}
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<div class="flex flex-col gap-3">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex flex-col gap-1 min-w-[240px] flex-1">
							<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								{statusMessage || t('panels.jwxt.statuses.loading')}
							</p>
							{#if status?.account?.userId}
								<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{format('panels.jwxt.statuses.accountLabel', { userId: status.account.userId })}
								</p>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<AppButton variant="secondary" size="sm" on:click={refreshStatus} disabled={loginBusy}>
								{t('panels.jwxt.refresh')}
							</AppButton>
							<AppButton variant="secondary" size="sm" on:click={handlePing} disabled={loginBusy}>
								{t('panels.jwxt.ping')}
							</AppButton>
							{#if status?.loggedIn}
								<AppButton variant="secondary" size="sm" on:click={handleLogout} disabled={loginBusy}>
									{t('panels.jwxt.logout')}
								</AppButton>
							{/if}
						</div>
					</div>

					{#if status?.loggedIn}
						<JwxtRoundSelector
							roundTermLabel={roundTermLabel}
							rounds={availableRounds}
							selectedXkkzId={selectedXkkzId}
							busy={roundBusy}
							statusText={roundStatus || roundCloudStatus}
							refreshDisabled={loginBusy}
							on:refresh={refreshRounds}
							on:select={(event) => handleSelectRound(event.detail.xkkzId)}
						/>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						<AppButton variant="primary" size="sm" on:click={handleCrawlData} disabled={$jwxtCrawlState.running}>
							{$jwxtCrawlState.running ? t('panels.jwxt.statuses.crawling') : t('panels.jwxt.crawlData')}
						</AppButton>
						{#if $jwxtCrawlState.running}
							<AppButton variant="secondary" size="sm" on:click={handleStopCrawl}>
								{t('panels.jwxt.crawlStop')}
							</AppButton>
						{/if}
						<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('panels.jwxt.crawlHint')}
						</span>
					</div>

					<AsyncTaskProgress
						visible={$jwxtCrawlState.running || Boolean($jwxtCrawlState.progress?.total)}
						statusText={crawlStatusText}
						progress={$jwxtCrawlState.progress}
						progressText={
							$jwxtCrawlState.progress?.total
								? t('panels.jwxt.statuses.crawlProgress', {
										done: $jwxtCrawlState.progress.done,
										total: $jwxtCrawlState.progress.total
									})
								: ''
						}
					/>

					{#if !status?.loggedIn}
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.loginMethodLabel')}</span>
							<AppButton
								variant={loginMethod === 'password' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => (loginMethod = 'password')}
								disabled={loginBusy}
							>
								{t('panels.jwxt.loginMethodPassword')}
							</AppButton>
							<AppButton
								variant={loginMethod === 'cookie' ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => (loginMethod = 'cookie')}
								disabled={loginBusy}
							>
								{t('panels.jwxt.loginMethodCookie')}
							</AppButton>
						</div>

						{#if loginMethod === 'password'}
							<form class="flex flex-col gap-3" on:submit|preventDefault={handleLogin}>
								<div class="flex flex-col gap-3">
									<AppField label={t('panels.jwxt.userIdLabel')}>
										<input class={inputClass} type="text" autocomplete="username" bind:value={$jwxtRememberedUserId} />
									</AppField>
									<AppField label={t('panels.jwxt.passwordLabel')}>
										<input class={inputClass} type="password" autocomplete="current-password" bind:value={password} />
									</AppField>
								</div>

								<div class="flex flex-col gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
									<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.persistHint')}</div>
									<div class="flex flex-wrap items-center gap-4 text-[var(--app-text-sm)]">
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist" value="none" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistNone')}</span>
										</label>
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist" value="device" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistDevice')}</span>
										</label>
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist" value="vault" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistVault')}</span>
										</label>
									</div>

									{#if persistMode === 'vault'}
										<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
											<AppField label={t('panels.jwxt.vaultPasswordLabel')}>
												<input class={inputClass} type="password" autocomplete="new-password" bind:value={vaultPassword} />
											</AppField>
											<AppField label={t('panels.jwxt.vaultPasswordConfirmLabel')}>
												<input class={inputClass} type="password" autocomplete="new-password" bind:value={vaultPasswordConfirm} />
											</AppField>
										</div>
										<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.persistVaultHint')}</div>
									{/if}
								</div>

								<AppControlRow>
									<AppButton buttonType="submit" variant="primary" size="sm" disabled={loginBusy || autoLoginBusy}>
										{loginBusy ? t('panels.jwxt.statuses.loggingIn') : t('panels.jwxt.login')}
									</AppButton>
									<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
										{t('panels.jwxt.loginHint')}
									</span>
								</AppControlRow>
								<AppControlRow>
									<JwxtUserscriptActions
										config={userscriptConfig}
										size="sm"
										installLabel={t('panels.jwxt.helpUserscript')}
										helpLabel={t('panels.jwxt.helpLink')}
									/>
								</AppControlRow>
							</form>
						{:else}
							<form class="flex flex-col gap-3" on:submit|preventDefault={importCookieHeader}>
								<div class="flex flex-col gap-3">
									<AppField label={t('panels.jwxt.userIdLabel')}>
										<input class={inputClass} type="text" autocomplete="username" bind:value={$jwxtRememberedUserId} />
									</AppField>
									<AppField label={t('panels.jwxt.cookieHeaderLabel')}>
										<AppTextArea rows={4} bind:value={cookieHeader} />
									</AppField>
								</div>

								<div class="flex flex-col gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
									<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.persistHint')}</div>
									<div class="flex flex-wrap items-center gap-4 text-[var(--app-text-sm)]">
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist-cookie" value="none" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistNone')}</span>
										</label>
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist-cookie" value="device" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistDevice')}</span>
										</label>
										<label class="flex items-center gap-2">
											<input type="radio" name="jwxt-persist-cookie" value="vault" bind:group={persistMode} />
											<span>{t('panels.jwxt.persistVault')}</span>
										</label>
									</div>

									{#if persistMode === 'vault'}
										<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
											<AppField label={t('panels.jwxt.vaultPasswordLabel')}>
												<input class={inputClass} type="password" autocomplete="new-password" bind:value={vaultPassword} />
											</AppField>
											<AppField label={t('panels.jwxt.vaultPasswordConfirmLabel')}>
												<input class={inputClass} type="password" autocomplete="new-password" bind:value={vaultPasswordConfirm} />
											</AppField>
										</div>
										<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.persistVaultHint')}</div>
									{/if}
								</div>

								<AppControlRow>
									<AppButton buttonType="submit" variant="primary" size="sm" disabled={loginBusy || autoLoginBusy}>
										{loginBusy ? t('panels.jwxt.statuses.importingCookie') : t('panels.jwxt.importCookie')}
									</AppButton>
									<span class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
										{t('panels.jwxt.cookieHint')}
									</span>
								</AppControlRow>
							</form>
						{/if}

						{#if cookieHasPasswordVault}
							<div class="flex flex-col gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
								<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.vaultUnlockHint')}</div>
								<div class="flex flex-wrap items-end gap-2">
									<div class="flex-1 min-w-[220px]">
										<AppField label={t('panels.jwxt.vaultUnlockPasswordLabel')}>
											<input class={inputClass} type="password" autocomplete="current-password" bind:value={vaultUnlockPassword} />
										</AppField>
									</div>
									<div class="flex flex-wrap gap-2">
										<AppButton variant="secondary" size="sm" on:click={unlockVaultAndImport} disabled={loginBusy}>
											{t('panels.jwxt.vaultUnlockAndLogin')}
										</AppButton>
										<AppButton
											variant="secondary"
											size="sm"
											on:click={() => clearJwxtCookieVault()}
											disabled={loginBusy}
										>
											{t('panels.jwxt.vaultClear')}
										</AppButton>
									</div>
								</div>
							</div>
						{/if}
						{#if cookieHasDeviceVault}
							<div class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
								<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.deviceVaultHint')}</div>
								<AppButton
									variant="secondary"
									size="sm"
									on:click={() => clearJwxtCookieDeviceVault()}
									disabled={loginBusy}
								>
									{t('panels.jwxt.deviceVaultClear')}
								</AppButton>
							</div>
						{/if}
					{/if}

					{#if status?.loggedIn}
						<div class="flex flex-wrap items-center gap-2">
							<AppButton variant="secondary" size="sm" on:click={saveSessionNow} disabled={loginBusy}>
								{t('panels.jwxt.persistSaveNow')}
							</AppButton>
							{#if cookieHasDeviceVault}
								<AppButton variant="secondary" size="sm" on:click={() => clearJwxtCookieDeviceVault()} disabled={loginBusy}>
									{t('panels.jwxt.deviceVaultClear')}
								</AppButton>
							{/if}
							{#if cookieHasPasswordVault}
								<AppButton variant="secondary" size="sm" on:click={() => clearJwxtCookieVault()} disabled={loginBusy}>
									{t('panels.jwxt.vaultClear')}
								</AppButton>
							{/if}
						</div>
					{/if}
				</div>
			</AppControlPanel>

			<AppControlPanel
				title={t('panels.jwxt.syncTitle')}
				description={t('panels.jwxt.syncDescription')}
				class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
			>
				<div class="flex flex-wrap items-center gap-3">
					<AppButton variant="primary" size="sm" on:click={() => handleSync()} disabled={syncBusy || !status?.loggedIn}>
						{syncBusy ? t('panels.jwxt.statuses.syncing') : t('panels.jwxt.syncFrom')}
					</AppButton>
						<AppButton
							variant="danger"
							size="sm"
							on:click={handlePreviewClick}
							disabled={pushBusy || pushPreviewBusy || !status?.loggedIn || !$termState?.jwxt.remoteSnapshot}
						>
							{pushBusy || pushPreviewBusy ? t('panels.jwxt.statuses.pushing') : t('panels.jwxt.pushTo')}
							</AppButton>
							<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								<input
									type="checkbox"
									checked={autoSyncEnabled}
								on:change={(event) =>
									void updateJwxtSettings({
										autoSyncEnabled: (event.currentTarget as HTMLInputElement).checked
									})}
								disabled={!status?.loggedIn || !$termState}
							/>
							<span>{t('panels.jwxt.autoSync')}</span>
						</label>
							<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								<input
									type="checkbox"
									checked={autoPushEnabled}
									on:change={(event) =>
										void updateJwxtSettings({
											autoPushEnabled: (event.currentTarget as HTMLInputElement).checked
										})}
									disabled={!status?.loggedIn || !$termState}
								/>
								<span>{t('panels.jwxt.autoPush')}</span>
							</label>
							<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								<input
									type="checkbox"
									checked={$jwxtPushPollingEnabled}
									on:change={async (event) => {
										const next = (event.currentTarget as HTMLInputElement).checked;
										if (!next) {
											const stopped = await stopJwxtPushPolling();
											if (!stopped.ok) setStatusMessage('panels.jwxt.statuses.pushFailed', { error: (stopped as any).error || 'Failed to stop' });
											return;
										}
										await handleStartPushPolling();
									}}
									disabled={!status?.loggedIn}
								/>
								<span>{t('panels.jwxt.pollPush.toggle')}</span>
							</label>
					<label class="flex items-center gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
						<span class="text-[var(--app-color-fg-muted)]">{t('panels.jwxt.autoSyncInterval')}</span>
						<select
							class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2.5 py-1.5 text-[var(--app-text-sm)]"
								value={autoSyncIntervalSec}
								on:change={(event) => {
									const raw = Number((event.currentTarget as HTMLSelectElement).value);
									const next = Number.isFinite(raw) ? Math.max(30, Math.round(raw)) : 120;
									void updateJwxtSettings({ autoSyncIntervalSec: next });
								}}
								disabled={!autoSyncEnabled || !$termState}
							>
								<option value={60}>60s</option>
								<option value={120}>120s</option>
								<option value={300}>300s</option>
							<option value={600}>600s</option>
						</select>
					</label>
				</div>
				{#if $jwxtPushPollingEnabled}
					<div class="mt-2 flex flex-wrap items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
						<span>{t('panels.jwxt.pollPush.taskLabel').replace('{id}', $jwxtPushPollingTaskId ?? '-')}</span>
						<label class="flex items-center gap-2">
							<span class="text-[var(--app-color-fg-muted)]">{t('panels.jwxt.pollPush.parallelLabel')}</span>
							<input
								class="w-20 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2.5 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
								type="number"
								min={JWXT_POLL_PUSH_CONCURRENCY.min}
								max={JWXT_POLL_PUSH_CONCURRENCY.max}
								bind:value={pushPollEnrollConcurrency}
							/>
						</label>
						<AppButton
							variant="secondary"
							size="sm"
							on:click={async () => {
								if (!$jwxtPushPollingTaskId) return;
								await updateJwxtPushPollingConcurrency(pushPollEnrollConcurrency);
							}}
						>
							{t('panels.jwxt.pollPush.applyParallel')}
						</AppButton>
						<AppButton variant="secondary" size="sm" on:click={() => stopJwxtPushPolling()}>
							{t('panels.jwxt.pollPush.stop')}
						</AppButton>
					</div>
				{/if}
					<div class="mt-2 flex flex-col gap-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
						<p class="m-0">{format('panels.jwxt.localCounts', { selected: $selectedCourseIds.size, wishlist: $wishlistCourseIds.size })}</p>
					{#if lastSyncAt}
						<p class="m-0">{format('panels.jwxt.lastSyncAt', { time: lastSyncAt.toLocaleString() })}</p>
					{/if}
					{#if lastPushAt}
						<p class="m-0">{format('panels.jwxt.lastPushAt', { time: lastPushAt.toLocaleString() })}</p>
					{/if}
						{#if pushStatus}
							<p class="m-0">{pushStatus}</p>
						{/if}
						{#if autoPushEnabled}
							<p class="m-0">{t('panels.jwxt.autoPushHint')}</p>
						{/if}
								{#if $jwxtPushPollingEnabled}
									<p class="m-0">{t('panels.jwxt.pollPush.hint')}</p>
								{/if}
						<p class="m-0">{t('panels.jwxt.confirmHint')}</p>
					</div>
				</AppControlPanel>

			<AppControlPanel
				title={t('panels.jwxt.enrollTitle')}
				description={t('panels.jwxt.enrollDescription')}
				class="flex-[2_1_720px] min-w-[min(360px,100%)] max-w-[1200px]"
			>
				<div class="flex flex-col gap-3">
					<CourseFiltersToolbar
						filters={enrollFiltersBase}
						options={getFilterOptionsForScope('jwxt')}
						mode="all"
						statusModeScope="jwxt"
					/>
					<CourseBulkBar
						busy={enrollBulkBusy}
						selectAllLabel={enrollBulkSelectLabel}
						clearSelectionLabel={t('panels.jwxt.bulk.clearSelection')}
						countLabel=""
						executeLabel={t('panels.jwxt.bulk.enrollExecute')}
						workingLabel={t('panels.jwxt.bulk.working')}
						disableSelectAll={enrollTotalItems === 0}
						disableClear={enrollBulkSelection.size === 0}
						disableExecute={enrollBulkSelection.size === 0 || !status?.loggedIn}
						onSelectAll={enrollBulkSelectVisible}
						onClearSelection={enrollBulkClear}
						onExecute={() => confirmBulkEnroll(Array.from(enrollBulkSelection))}
					>
						<svelte:fragment slot="leading">
							<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
								{t('panels.jwxt.bulk.label').replace('{count}', String(enrollBulkSelection.size))}
							</span>
						</svelte:fragment>
					</CourseBulkBar>
					<div class="flex flex-col min-h-[240px] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]">
						{#if enrollTotalItems === 0}
							<p class="px-6 py-10 text-center text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">
								{t('panels.allCourses.empty')}
							</p>
						{:else}
							{#if $paginationMode === 'paged'}
								<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
									{#each enrollVisibleCourses as entry, index (entry.id)}
										{@const absIndex = enrollWindowStartIndex + index}
										{@const pairKey = `${entry.courseCode}::${entry.sectionId}`}
										{@const alreadySelected = remoteSelectedKeySet.has(pairKey)}
										{@const meta = enrollFilterResult.meta.get(entry.id)}
										{@const timeConflict = meta?.conflict === 'time-conflict'}
										{@const conflictItems = meta?.diagnostics?.length
											? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
											: null}
										{@const showConflictBadges = $enrollFiltersBase.showConflictBadges}
										<CourseCard
											id={entry.id}
											title={entry.title}
											teacher={entry.teacher}
											time={entry.slot ?? t('courseCard.noTime')}
											courseCode={entry.courseCode}
											credit={entry.credit ?? null}
											status={entry.status}
											capacity={entry.capacity}
											vacancy={entry.vacancy}
											colorSeed={entry.id}
											specialTags={entry.specialTags}
											onHover={() => handleHover(entry, 'list')}
											onLeave={() => handleLeave('list')}
											toneIndex={absIndex}
											showConflictBadge={showConflictBadges && Boolean(conflictItems)}
											conflictDetails={showConflictBadges ? conflictItems : null}
										>
											<svelte:fragment slot="meta-controls">
												<CardBulkCheckbox
													checked={enrollBulkSelection.has(entry.id)}
													disabled={!isEnrollEligible(entry)}
													ariaLabel={t('panels.jwxt.bulk.selectEnroll').replace('{name}', entry.title)}
													on:toggle={() => enrollBulkToggle(entry.id)}
												/>
											</svelte:fragment>
											<CardActionBar slot="actions" class="justify-start">
												<AppButton
													variant="secondary"
													size="sm"
													on:click={() => openBreakdown(entry)}
													disabled={!status?.loggedIn}
												>
													{t('panels.jwxt.breakdownButton')}
												</AppButton>
												<AppButton
													variant="primary"
													size="sm"
													on:click={() => confirmRemoteEnroll(entry)}
													disabled={!status?.loggedIn || !isEnrollEligible(entry)}
												>
													{t('panels.jwxt.enroll')}
												</AppButton>
											</CardActionBar>
										</CourseCard>
									{/each}
								</div>
							{:else}
								<ContinuousPager
									items={enrollCourses}
									pageSize={enrollPageSizeValue}
									neighbors={$pageNeighbors}
									{scrollRoot}
									bind:activePage={enrollContinuousActivePage}
									let:page
								>
									<div class="flex flex-col divide-y divide-[color:var(--app-color-border-subtle)]">
										{#each page.items as entry, index (entry.id)}
											{@const absIndex = page.start + index}
											{@const pairKey = `${entry.courseCode}::${entry.sectionId}`}
											{@const alreadySelected = remoteSelectedKeySet.has(pairKey)}
											{@const meta = enrollFilterResult.meta.get(entry.id)}
											{@const timeConflict = meta?.conflict === 'time-conflict'}
											{@const conflictItems = meta?.diagnostics?.length
												? meta.diagnostics.map((d) => ({ label: d.label, value: d.reason }))
												: null}
											{@const showConflictBadges = $enrollFiltersBase.showConflictBadges}
											<CourseCard
												id={entry.id}
												title={entry.title}
												teacher={entry.teacher}
												time={entry.slot ?? t('courseCard.noTime')}
												courseCode={entry.courseCode}
												credit={entry.credit ?? null}
												status={entry.status}
												capacity={entry.capacity}
												vacancy={entry.vacancy}
												colorSeed={entry.id}
												specialTags={entry.specialTags}
												onHover={() => handleHover(entry, 'list')}
												onLeave={() => handleLeave('list')}
												toneIndex={absIndex}
												showConflictBadge={showConflictBadges && Boolean(conflictItems)}
												conflictDetails={showConflictBadges ? conflictItems : null}
											>
												<svelte:fragment slot="meta-controls">
													<CardBulkCheckbox
														checked={enrollBulkSelection.has(entry.id)}
														disabled={!isEnrollEligible(entry)}
														ariaLabel={t('panels.jwxt.bulk.selectEnroll').replace('{name}', entry.title)}
														on:toggle={() => enrollBulkToggle(entry.id)}
													/>
												</svelte:fragment>
												<CardActionBar slot="actions" class="justify-start">
													<AppButton
														variant="secondary"
														size="sm"
														on:click={() => openBreakdown(entry)}
														disabled={!status?.loggedIn}
													>
														{t('panels.jwxt.breakdownButton')}
													</AppButton>
													<AppButton
														variant="primary"
														size="sm"
														on:click={() => confirmRemoteEnroll(entry)}
														disabled={!status?.loggedIn || !isEnrollEligible(entry)}
													>
														{t('panels.jwxt.enroll')}
													</AppButton>
												</CardActionBar>
											</CourseCard>
										{/each}
									</div>
								</ContinuousPager>
							{/if}
						{/if}

						{#if showEnrollPaginationFooter}
							<div class="mt-auto border-t border-[color:var(--app-color-border-subtle)] px-3 py-1">
								<AppPagination
									currentPage={enrollCurrentPage}
									totalPages={enrollTotalPages}
									pageNeighbors={$pageNeighbors}
									onPageChange={handleEnrollPageChange}
								/>
							</div>
						{/if}
					</div>
				</div>
			</AppControlPanel>

			{#if remoteSelected.length}
				<AppControlPanel
					title={t('panels.jwxt.remoteSelectedTitle')}
					description={t('panels.jwxt.remoteSelectedDescription')}
					class="flex-[1_1_520px] min-w-[min(360px,100%)] max-w-[860px]"
				>
					<div class="flex flex-col gap-3">
						<CourseBulkBar
							busy={dropBulkBusy}
							selectAllLabel={t('panels.jwxt.bulk.selectAll')}
							clearSelectionLabel={t('panels.jwxt.bulk.clearSelection')}
							countLabel=""
							executeLabel={t('panels.jwxt.bulk.dropExecute')}
							workingLabel={t('panels.jwxt.bulk.working')}
							disableSelectAll={remoteSelected.length === 0}
							disableClear={dropBulkSelection.size === 0}
							disableExecute={dropBulkSelection.size === 0 || !status?.loggedIn}
							onSelectAll={dropBulkSelectAll}
							onClearSelection={dropBulkClear}
							onExecute={() => confirmBulkDrop(Array.from(dropBulkSelection))}
						>
							<svelte:fragment slot="leading">
								<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
									{t('panels.jwxt.bulk.label').replace('{count}', String(dropBulkSelection.size))}
								</span>
							</svelte:fragment>
						</CourseBulkBar>

						<div class="flex flex-col gap-2">
							{#each remoteSelected as item (item.kchId + ':' + item.jxbId)}
								{@const pairKey = `${item.kchId}::${item.jxbId}`}
							{@const localId = mapRemotePairToLocalId(item)}
							{@const entry = localId ? courseCatalogMap.get(localId) : null}
							{#if entry}
								{@const candidateGranularity = $termState?.settings.granularity.candidates ?? 'groupPreferred'}
								{@const candidateGroupKey = deriveGroupKey(entry)}
								{@const copyDisabled =
									candidateGranularity === 'groupPreferred'
										? ($termState?.selection.wishlistGroups ?? []).includes(candidateGroupKey)
										: $wishlistCourseIds.has(entry.id)}
								<CourseCard
									id={entry.id}
									title={entry.title}
									teacher={entry.teacher}
									time={entry.slot ?? t('courseCard.noTime')}
									courseCode={entry.courseCode}
									credit={entry.credit ?? null}
									status={entry.status}
									capacity={entry.capacity}
									vacancy={entry.vacancy}
									colorSeed={entry.id}
									specialTags={entry.specialTags}
									onHover={() => handleHover(entry, 'selected')}
									onLeave={() => handleLeave('selected')}
								>
									<svelte:fragment slot="meta-controls">
										<CardBulkCheckbox
											checked={dropBulkSelection.has(pairKey)}
											ariaLabel={t('panels.jwxt.bulk.selectDrop').replace('{name}', entry.title)}
											on:toggle={() => dropBulkToggle(pairKey)}
										/>
									</svelte:fragment>
									<CardActionBar slot="actions" class="justify-start">
										{#if $selectedCourseIds.has(entry.id)}
											<AppButton variant="secondary" size="sm" on:click={() => deselectCourse(entry.id)}>
												{t('panels.jwxt.planDrop')}
											</AppButton>
										{:else}
											<AppButton
												variant="secondary"
												size="sm"
												on:click={() => copyRemoteToWishlist(entry)}
												disabled={copyDisabled}
											>
												{t('panels.jwxt.copyToWishlist')}
											</AppButton>
										{/if}
										<AppButton
											variant="danger"
											size="sm"
											on:click={() =>
												confirmRemoteDrop({
													kchId: item.kchId,
													jxbId: item.jxbId,
													label: describeCourse(entry)
												})}
											disabled={!status?.loggedIn}
										>
										{t('panels.jwxt.dropNow')}
									</AppButton>
								</CardActionBar>
							</CourseCard>
							{:else}
								<AppListCard title={`${item.kchId} · ${item.jxbId}`} subtitle={t('panels.jwxt.remoteSelectedNoMapping')}>
									<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-warning)]">
										{t('panels.jwxt.planUnavailableHint')}
									</p>
									<CardActionBar slot="actions" class="justify-start">
										<CardBulkCheckbox
											checked={dropBulkSelection.has(pairKey)}
											ariaLabel={t('panels.jwxt.bulk.selectDropNoMapping').replace('{kchId}', item.kchId).replace('{jxbId}', item.jxbId)}
											on:toggle={() => dropBulkToggle(pairKey)}
										/>
										<AppButton
											variant="danger"
											size="sm"
											on:click={() =>
												confirmRemoteDrop({
													kchId: item.kchId,
													jxbId: item.jxbId,
													label: `${item.kchId} (${item.jxbId})`
												})}
											disabled={!status?.loggedIn}
										>
											{t('panels.jwxt.dropNow')}
										</AppButton>
									</CardActionBar>
								</AppListCard>
							{/if}
							{/each}
						</div>
					</div>
				</AppControlPanel>
			{/if}
		</div>

		<AppDialog
			open={breakdownOpen}
			title={format('panels.jwxt.breakdownTitle', { course: breakdownEntryLabel || '-' })}
			on:close={() => {
				if (breakdownBusy) return;
				breakdownOpen = false;
				breakdownError = '';
			}}
		>
			{#if breakdownBusy}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.breakdownLoading')}</p>
			{:else if breakdownError}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-danger)]">{breakdownError}</p>
			{:else if breakdown}
					{@const userBatchLabel =
						breakdownUserBatch?.kind === 'available' && breakdownUserBatch.source === 'userscript'
							? breakdownUserBatch.label
							: null}
					{@const policyEnabled = Boolean(minAcceptableBatchLabel) && minAcceptableBatchLabel !== ENROLLMENT_BATCH_ORDER[ENROLLMENT_BATCH_ORDER.length - 1]}
					{@const policyAllowed =
						policyEnabled && breakdownUserBatch
							? (globalJwxtPolicyRegistry.applyAll({
									userBatch: breakdownUserBatch as any,
									userMinPolicy: { minAcceptable: minAcceptableBatchLabel! } as any
							  }).find((r) => r.id === 'jwxt:user-min-acceptable-batch')?.ok ?? null)
							: null}

				<div class="flex flex-col gap-2">
					<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
						{t('panels.jwxt.breakdownHint')}
					</p>

					{#if userBatchLabel}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							{t('panels.jwxt.breakdownUserBatch', { batch: userBatchLabel })}
							{#if policyEnabled}
								<span class="text-[var(--app-color-fg-muted)]">
									· {t('panels.jwxt.breakdownMinBatch', { min: minAcceptableBatchLabel! })}
									{#if policyAllowed === true}
										· {t('panels.jwxt.batchPolicyAllowed')}
									{:else if policyAllowed === false}
										· <span class="text-[var(--app-color-danger)]">{t('panels.jwxt.batchPolicyDeniedShort')}</span>
									{/if}
								</span>
							{/if}
						</p>
					{:else}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
							{t('panels.jwxt.breakdownNoUserBatch')}
						</p>
					{/if}

					{#if breakdownInterval?.start !== undefined && breakdownInterval?.end !== undefined}
						<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
							{t('panels.jwxt.breakdownRankHint', { start: breakdownInterval.start + 1, end: breakdownInterval.end })}
						</p>
					{/if}
				</div>

				<div class="mt-3 overflow-auto rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)]">
					<table class="w-full border-collapse text-[var(--app-text-sm)]">
						<thead>
							<tr class="bg-[color:var(--app-color-bg-subtle)] text-[var(--app-color-fg-muted)]">
								{#each (breakdown.header ?? [t('panels.jwxt.breakdownColType'), t('panels.jwxt.breakdownColValue'), t('panels.jwxt.breakdownColMarker')]) as h (h)}
									<th class="px-3 py-2 text-left font-medium">{h}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each breakdown.items as item (item.label)}
								{@const starred = item.marker === 'star'}
								<tr class={starred ? 'bg-[color:var(--app-color-primary)]/10' : ''}>
									<td class="px-3 py-2">{item.label}</td>
									<td class="px-3 py-2">{item.value ?? item.rawValueText}</td>
									<td class="px-3 py-2">{starred ? '★' : item.rawMarkerText ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.jwxt.breakdownEmpty')}</p>
			{/if}

			<div slot="actions" class="flex flex-wrap items-center justify-end gap-2">
				<AppButton variant="secondary" size="sm" on:click={() => (breakdownOpen = false)} disabled={breakdownBusy}>
					{t('panels.jwxt.confirm.cancel')}
				</AppButton>
			</div>
		</AppDialog>

		<AppDialog
			open={confirmOpen}
			title={confirmTitle}
			on:close={() => {
				if (confirmBusy) return;
				confirmOpen = false;
				confirmError = '';
				confirmKind = 'default';
			}}
		>
			<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">{confirmBody}</p>
			{#if confirmKind === 'jwxt-push'}
				<div class="mt-3 flex flex-col gap-2">
					<label class="flex flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
						<span class="text-[var(--app-color-fg-muted)]">{t('panels.jwxt.ttlLabel')}</span>
						<select
							class="w-full rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
							bind:value={pendingTtlMs}
							disabled={confirmBusy}
						>
							<option value={0}>{t('panels.jwxt.ttl0')}</option>
							<option value={120000}>{t('panels.jwxt.ttl120')}</option>
						</select>
					</label>
				</div>
			{/if}
			{#if confirmSections.length}
				<div class="mt-3 flex flex-col gap-3">
					{#each confirmSections as section (section.title)}
						<div class="flex flex-col gap-2">
							<p class="m-0 text-[var(--app-text-xs)] font-medium text-[var(--app-color-fg)]">{section.title}</p>
							{#if section.items.length}
								<ul class="m-0 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{#each section.items as item (item)}
										<li class="break-words [overflow-wrap:anywhere]">{item}</li>
									{/each}
								</ul>
							{:else}
								<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{t('panels.jwxt.confirm.pushDiffEmpty')}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			{#if confirmError}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-danger)]">{confirmError}</p>
			{/if}
			<div slot="actions" class="flex flex-wrap items-center justify-end gap-2">
				<AppButton variant="secondary" size="sm" on:click={() => (confirmOpen = false)} disabled={confirmBusy}>
					{t('panels.jwxt.confirm.cancel')}
				</AppButton>
				<AppButton variant={confirmVariant} size="sm" on:click={runConfirmedAction} loading={confirmBusy}>
					{confirmConfirmLabel}
				</AppButton>
			</div>
		</AppDialog>
	</ListSurface>
</DockPanelShell>
