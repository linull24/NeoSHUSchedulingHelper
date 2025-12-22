<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy, onMount, mount, unmount } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	import { browser } from '$app/environment';
	import { translator } from '$lib/i18n';
	import MinimalWorkspace from '$lib/components/MinimalWorkspace.svelte';
	import {
		workspacePanels,
		type WorkspacePanelType
	} from '$lib/components/workspacePanels';
	import {
		DockviewComponent,
		type DockviewIDisposable,
		getPanelData,
		themeLight,
		type Direction,
		type DockviewPanel,
		type DockviewPanelApi,
		type GroupPanelPartInitParameters,
		type ITabRenderer,
		type IContentRenderer
	} from 'dockview-core';
	import 'dockview-core/dist/styles/dockview.css';
	import '$lib/styles/dockview.css';

	const fallbackEnterWidth = 960;
	const fallbackExitWidth = 1180;
	const dndEdgesNormal = {
		activationSize: { type: 'pixels', value: 24 },
		size: { type: 'percentage', value: 50 }
	} as const;
	const dndEdgesSashAssist = {
		activationSize: { type: 'percentage', value: 45 },
		size: { type: 'percentage', value: 50 }
	} as const;

	type PanelTitleMap = Record<WorkspacePanelType, string>;
	type LayoutStep = {
		id: WorkspacePanelType;
		reference?: WorkspacePanelType;
		direction?: Direction;
	};

	// Default "品字"：左上日历 + 左下求解器 + 右侧全课程（含已选/候选 tabs）
	const layoutPlan: LayoutStep[] = [
		{ id: 'course-calendar' },
		{ id: 'solver', reference: 'course-calendar', direction: 'below' },
		{ id: 'all-courses', reference: 'course-calendar', direction: 'right' },
		{ id: 'selected', reference: 'all-courses', direction: 'within' },
		{ id: 'candidates', reference: 'all-courses', direction: 'within' },
		{ id: 'action-log', reference: 'solver', direction: 'within' },
		{ id: 'sync', reference: 'solver', direction: 'within' },
		{ id: 'jwxt', reference: 'solver', direction: 'within' },
		{ id: 'jwxt-io', reference: 'solver', direction: 'within' },
		{ id: 'settings', reference: 'solver', direction: 'within' }
	];

	let workspaceRef: HTMLDivElement | null = null;
	let dockHost: HTMLDivElement | null = null;
	let dockview: DockviewComponent | null = null;
	let widthObserver: ResizeObserver | null = null;
	let dndAssistDisposables: DockviewIDisposable[] = [];
	let layoutPersistenceDisposables: DockviewIDisposable[] = [];
	let isSashAssistActive = false;
	let workspaceFocusListener: ((event: Event) => void) | null = null;
	let autoFallback = false;
	let layoutError = false;
	let errorDetail: string | null = null;
	let useFallback = false;
	export let className = '';

	const panelApis = new Map<WorkspacePanelType, DockviewPanelApi>();
	const LAYOUT_COOKIE_KEY = 'dockview_layout_v1';
	const LAYOUT_COOKIE_CHUNK_SIZE = 3600;
	const LAYOUT_LS_KEY = 'dockview_layout_v1';

	let t = (key: string) => key;
	$: t = $translator;
	let panelTitles: PanelTitleMap = buildPanelTitles(t);
	$: panelTitles = buildPanelTitles(t);

	onMount(() => {
		workspaceFocusListener = (event: Event) => {
			const detail = (event as CustomEvent).detail as { panelId?: WorkspacePanelType } | undefined;
			const panelId = detail?.panelId;
			if (!panelId) return;
			panelApis.get(panelId)?.setActive();
		};
		window.addEventListener('workspace:focus', workspaceFocusListener as EventListener);

		widthObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === workspaceRef) {
					updateAutoFallback(entry.contentRect.width);
				}
			}
		});

		if (workspaceRef) {
			widthObserver.observe(workspaceRef);
		}
	});

	onDestroy(() => {
		widthObserver?.disconnect();
		widthObserver = null;
		if (workspaceFocusListener) {
			window.removeEventListener('workspace:focus', workspaceFocusListener as EventListener);
			workspaceFocusListener = null;
		}
		teardownDockview();
	});

	$: useFallback = layoutError || autoFallback;

	$: if (!useFallback && browser && dockHost) {
		ensureDockviewMounted();
	} else {
		teardownDockview();
	}

	$: if (!useFallback && dockview) {
		updatePanelTitles(panelTitles);
	}

	function buildPanelTitles(translate: (key: string) => string): PanelTitleMap {
		return {
			'course-calendar': translate('calendar.title'),
			'all-courses': translate('panels.allCourses.title'),
			candidates: translate('panels.candidates.title'),
			selected: translate('panels.selected.title'),
			solver: translate('panels.solver.title'),
			'action-log': translate('panels.actionLog.title'),
			sync: translate('panels.sync.title'),
			jwxt: translate('panels.jwxt.title'),
			'jwxt-io': translate('panels.jwxtIo.title'),
			settings: translate('settings.title')
		};
	}

	function updateAutoFallback(width: number) {
		if (!width) return;

		if (width < fallbackEnterWidth) {
			autoFallback = true;
		} else if (width > fallbackExitWidth && autoFallback) {
			autoFallback = false;
		}
	}

	function ensureDockviewMounted() {
		if (dockview || !dockHost) return;
		errorDetail = null;

		try {
			dockview = new DockviewComponent(dockHost, {
				createComponent: ({ name }) => createRenderer(assertPanelType(name)),
				createTabComponent: () => createNoCloseTabRenderer(),
				className: 'dockview-theme-app',
				theme: themeLight,
				dndEdges: {
					...dndEdgesNormal
				},
				disableFloatingGroups: false,
				floatingGroupBounds: 'boundedWithinViewport',
				scrollbars: 'native'
			});

			registerSashAssist(dockview);
			const restored = restoreLayout(dockview);
			if (!restored) buildDefaultLayout();
			registerLayoutPersistence(dockview);
			layoutError = false;
		} catch (error) {
			layoutError = true;
			errorDetail = error instanceof Error ? error.message : String(error);
			console.error('Failed to initialize Dockview workspace:', error);
		}
	}

	function teardownDockview() {
		teardownSashAssist();
		layoutPersistenceDisposables.forEach((disposable) => disposable.dispose());
		layoutPersistenceDisposables = [];
		if (dockview) {
			try {
				dockview.dispose();
			} catch (error) {
				console.error('Error disposing Dockview:', error);
			}
		}
		dockview = null;
		panelApis.clear();
	}

	function teardownSashAssist() {
		dndAssistDisposables.forEach((disposable) => disposable.dispose());
		dndAssistDisposables = [];
		isSashAssistActive = false;
	}

	function readCookie(key: string): string | null {
		if (!browser) return null;
		try {
			const target = `${encodeURIComponent(key)}=`;
			const parts = document.cookie.split(';');
			for (const part of parts) {
				const trimmed = part.trim();
				if (trimmed.startsWith(target)) return trimmed.slice(target.length);
			}
		} catch {
			// ignore
		}
		return null;
	}

	function writeCookie(key: string, value: string) {
		if (!browser) return;
		try {
			// Cookie size limit is ~4KB; keep best-effort.
			if (value.length > 3800) return;
			const secure = window.location.protocol === 'https:' ? '; Secure' : '';
			document.cookie = `${encodeURIComponent(key)}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
		} catch {
			// ignore
		}
	}

	function deleteCookie(key: string) {
		if (!browser) return;
		try {
			const secure = window.location.protocol === 'https:' ? '; Secure' : '';
			document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
		} catch {
			// ignore
		}
	}

	function base64UrlEncodeString(value: string) {
		const bytes = new TextEncoder().encode(value);
		let raw = '';
		for (const b of bytes) raw += String.fromCharCode(b);
		const base64 = btoa(raw);
		return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
	}

	function base64UrlDecodeToString(value: string): string | null {
		try {
			let base64 = value.replaceAll('-', '+').replaceAll('_', '/');
			while (base64.length % 4) base64 += '=';
			const raw = atob(base64);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
			return new TextDecoder().decode(bytes);
		} catch {
			return null;
		}
	}

	function readCookieChunks(baseKey: string): string | null {
		const countRaw = readCookie(`${baseKey}__count`);
		const count = Number.parseInt(String(countRaw || ''), 10);
		if (!Number.isFinite(count) || count <= 0 || count > 50) return null;

		let joined = '';
		for (let i = 0; i < count; i += 1) {
			const part = readCookie(`${baseKey}__${i}`);
			if (part == null) return null;
			joined += part;
		}
		return base64UrlDecodeToString(joined);
	}

	function writeCookieChunks(baseKey: string, rawValue: string) {
		const encoded = base64UrlEncodeString(rawValue);
		const chunks: string[] = [];
		for (let i = 0; i < encoded.length; i += LAYOUT_COOKIE_CHUNK_SIZE) {
			chunks.push(encoded.slice(i, i + LAYOUT_COOKIE_CHUNK_SIZE));
		}

		// Defensive cleanup: remove stale chunks.
		const prevCountRaw = readCookie(`${baseKey}__count`);
		const prevCount = Number.parseInt(String(prevCountRaw || ''), 10);
		if (Number.isFinite(prevCount) && prevCount > 0 && prevCount <= 50) {
			for (let i = 0; i < prevCount; i += 1) deleteCookie(`${baseKey}__${i}`);
			deleteCookie(`${baseKey}__count`);
		}

		if (!chunks.length || chunks.length > 50) return;

		writeCookie(`${baseKey}__count`, String(chunks.length));
		for (let i = 0; i < chunks.length; i += 1) {
			writeCookie(`${baseKey}__${i}`, chunks[i]!);
		}
	}

	function restoreLayout(target: DockviewComponent): boolean {
		const raw = readLayoutString();
		if (!raw) return false;
		try {
			const parsed = JSON.parse(raw) as unknown;
			target.fromJSON(parsed as any);
			if (dockHost) (target as any).layout?.(dockHost.clientWidth, dockHost.clientHeight);
			return true;
		} catch (error) {
			console.warn('Failed to restore Dockview layout cookie; falling back to default layout:', error);
			return false;
		}
	}

	function readLayoutString(): string | null {
		if (!browser) return null;
		try {
			const fromLs = localStorage.getItem(LAYOUT_LS_KEY);
			if (fromLs && fromLs.trim()) return fromLs;
		} catch {
			// ignore
		}
		return readCookieChunks(LAYOUT_COOKIE_KEY) ?? readCookie(LAYOUT_COOKIE_KEY);
	}

	function writeLayoutString(value: string) {
		if (!browser) return;
		try {
			localStorage.setItem(LAYOUT_LS_KEY, value);
		} catch {
			// ignore
		}
		// Best-effort cookie mirror for users who want cookie persistence.
		writeCookieChunks(LAYOUT_COOKIE_KEY, value);
	}

	function registerLayoutPersistence(target: DockviewComponent) {
		layoutPersistenceDisposables.forEach((disposable) => disposable.dispose());
		layoutPersistenceDisposables = [];

		let pending = 0;
		let lastWritten = '';
		const flush = () => {
			pending = 0;
			try {
				const next = JSON.stringify(target.toJSON());
				if (next === lastWritten) return;
				lastWritten = next;
				writeLayoutString(next);
			} catch {
				// ignore
			}
		};
		const schedule = () => {
			if (pending) return;
			pending = window.setTimeout(flush, 250);
		};

		layoutPersistenceDisposables.push(
			target.onDidDrop(() => schedule()),
			target.onDidMovePanel(() => schedule()),
			target.onDidAddPanel(() => schedule()),
			target.onDidRemovePanel(() => schedule()),
			target.onDidMaximizedGroupChange(() => schedule())
		);

		const onUserInteractionEnd = () => schedule();
		window.addEventListener('mouseup', onUserInteractionEnd);
		window.addEventListener('touchend', onUserInteractionEnd);
		window.addEventListener('pointerup', onUserInteractionEnd);
		layoutPersistenceDisposables.push({
			dispose() {
				window.removeEventListener('mouseup', onUserInteractionEnd);
				window.removeEventListener('touchend', onUserInteractionEnd);
				window.removeEventListener('pointerup', onUserInteractionEnd);
			}
		});

		// Save once after initial layout is ready.
		schedule();
	}

	function registerSashAssist(target: DockviewComponent) {
		teardownSashAssist();

		const refresh = (next: boolean) => {
			if (next === isSashAssistActive) return;
			isSashAssistActive = next;
			target.updateOptions({ dndEdges: next ? dndEdgesSashAssist : dndEdgesNormal });
		};

		const onDragOverCapture = (event: DragEvent) => {
			if (!dockHost) return;
			const data = getPanelData();
			if (!data) {
				refresh(false);
				return;
			}
			const hit = findNearestSashHit(dockHost, event.clientX, event.clientY);
			refresh(Boolean(hit));
		};

		const onDropOrEndCapture = () => {
			refresh(false);
		};

		document.addEventListener('dragover', onDragOverCapture, true);
		document.addEventListener('drop', onDropOrEndCapture, true);
		window.addEventListener('dragend', onDropOrEndCapture, true);

		dndAssistDisposables.push({
			dispose() {
				document.removeEventListener('dragover', onDragOverCapture, true);
				document.removeEventListener('drop', onDropOrEndCapture, true);
				window.removeEventListener('dragend', onDropOrEndCapture, true);
			}
		});
	}

	function findNearestSashHit(host: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

		const hostRect = host.getBoundingClientRect();
		if (
			clientX < hostRect.left ||
			clientX > hostRect.right ||
			clientY < hostRect.top ||
			clientY > hostRect.bottom
		) {
			return null;
		}

		const sashes = Array.from(host.querySelectorAll<HTMLElement>('.dv-sash'));
		if (sashes.length === 0) return null;

		const hitPadding = 10;
		for (const sash of sashes) {
			const rect = sash.getBoundingClientRect();
			if (
				clientX >= rect.left - hitPadding &&
				clientX <= rect.right + hitPadding &&
				clientY >= rect.top - hitPadding &&
				clientY <= rect.bottom + hitPadding
			) {
				return sash;
			}
		}

		return null;
	}

	function assertPanelType(name: string): WorkspacePanelType {
		if (name in workspacePanels) {
			return name as WorkspacePanelType;
		}
		throw new Error(`Unknown workspace panel: ${name}`);
	}

	function createRenderer(panelType: WorkspacePanelType): IContentRenderer {
		const ComponentCtor = workspacePanels[panelType];
		const element = document.createElement('div');
		element.className = 'flex h-full w-full min-h-0 min-w-0 flex-col';
		let mounted: ReturnType<typeof mount> | null = null;

		return {
			element,
			init: (params: GroupPanelPartInitParameters) => {
				mounted = mount(ComponentCtor, { target: element }) as SvelteComponent;
				panelApis.set(panelType, params.api);
				params.api.setTitle(panelTitles[panelType]);
			},
			dispose: () => {
				panelApis.delete(panelType);
				if (mounted) {
					unmount(mounted);
					mounted = null;
				}
				element.replaceChildren();
			}
		};
	}

	function createNoCloseTabRenderer(): ITabRenderer {
		const element = document.createElement('div');
		element.className = 'dv-default-tab';
		const content = document.createElement('div');
		content.className = 'dv-default-tab-content';
		element.appendChild(content);

		let titleDisposable: DockviewIDisposable | null = null;

		return {
			element,
			init: (params) => {
				content.textContent = params.title ?? '';
				titleDisposable = params.api.onDidTitleChange((event) => {
					content.textContent = event.title ?? '';
				});
			},
			dispose: () => {
				titleDisposable?.dispose();
				titleDisposable = null;
				element.replaceChildren();
			}
		};
	}

	function buildDefaultLayout() {
		const target = dockview;
		if (!target) return;

		type DockviewPanelRef = DockviewComponent['panels'][number];
		const createdPanels = new Map<WorkspacePanelType, DockviewPanelRef>();
		layoutPlan.forEach((step) => {
			// Defensive: in dev/HMR or unexpected remounts, avoid creating duplicate panels.
			// Dockview identifies panels by id, so treat an existing panel as already created.
			const existing = target.panels.find((panel) => panel.id === step.id);
			if (existing) {
				createdPanels.set(step.id, existing);
				return;
			}

			let panel: DockviewPanelRef;

			if (step.reference) {
				const reference = createdPanels.get(step.reference);
				if (!reference) {
					throw new Error(`Missing reference panel for ${step.id}`);
				}
				panel = target.addPanel({
					id: step.id,
					component: step.id,
					title: panelTitles[step.id],
					position: {
						referencePanel: reference,
						direction: step.direction ?? 'right'
					}
				});
			} else {
				panel = target.addPanel({
					id: step.id,
					component: step.id,
					title: panelTitles[step.id]
				});
			}

			createdPanels.set(step.id, panel);
		});
	}

	function updatePanelTitles(titles: PanelTitleMap) {
		panelApis.forEach((api, panelType) => {
			const title = titles[panelType];
			if (title) {
				api.setTitle(title);
			}
		});
	}
</script>

<div
	bind:this={workspaceRef}
	class={`flex h-full min-h-0 w-full flex-col gap-3 text-[var(--app-text-sm)] text-[var(--app-color-fg)] ${className}`.trim()}
>
	{#if layoutError}
		<div
			class="rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-danger)] bg-[color-mix(in_srgb,var(--app-color-danger)_10%,var(--app-color-bg))] p-3 text-[var(--app-text-sm)] text-[var(--app-color-danger)]"
		>
			<p class="m-0 font-medium">{t('layout.workspace.loadErrorTitle')}</p>
			<p class="mt-2">{t('layout.workspace.loadErrorHint')}</p>
			{#if errorDetail}
				<p class="mt-2 text-[var(--app-text-xs)] opacity-80">{errorDetail}</p>
			{/if}
		</div>
	{/if}

	{#if useFallback}
		<div
			class="flex flex-1 min-h-0 flex-col gap-2.5 rounded-[var(--app-radius-xl)] border border-dashed border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-3 shadow-[var(--app-shadow-soft)]"
		>
			{#if autoFallback}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('layout.workspace.narrowMessage')}</p>
			{/if}
			<MinimalWorkspace {panelTitles} />
		</div>
	{:else}
		<div
			class="flex flex-1 min-h-0 rounded-[var(--app-radius-xl)] bg-[var(--app-color-bg-elevated)] p-0 shadow-[var(--app-shadow-hard)] overflow-hidden"
		>
			<div bind:this={dockHost} class="dockview-theme-app flex h-full w-full min-h-0 rounded-[var(--app-radius-lg)]"></div>
		</div>
	{/if}
</div>
