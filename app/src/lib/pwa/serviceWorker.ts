import { browser, dev } from '$app/environment';
import { base } from '$app/paths';

export type ServiceWorkerStatus = {
	supported: boolean;
	registered: boolean;
	controlled: boolean;
	disabledInDev?: boolean;
	scope?: string;
	error?: string;
};

export async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerStatus> {
	if (!browser) return { supported: false, registered: false, controlled: false };
	const supported = 'serviceWorker' in navigator;
	if (!supported) return { supported: false, registered: false, controlled: false };
	if (dev) {
		return {
			supported: true,
			registered: false,
			controlled: Boolean(navigator.serviceWorker.controller),
			disabledInDev: true
		};
	}

	try {
		const scope = `${base || ''}/`;
		const registration = await navigator.serviceWorker.register(`${scope}service-worker.js`, { scope });

		// Aggressively keep SW updated on static deployments, otherwise users may remain stuck on
		// stale bundles/env config for a long time.
		try {
			await registration.update();
		} catch {
			// ignore
		}

		const maybeSkipWaiting = () => {
			try {
				registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
			} catch {
				// ignore
			}
		};

		// If a new SW is already waiting, activate it now.
		maybeSkipWaiting();

		let reloaded = false;
		const onControllerChange = () => {
			if (reloaded) return;
			reloaded = true;
			// Hard reload to pick up new bundles and env.
			window.location.reload();
		};
		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });

		registration.addEventListener('updatefound', () => {
			const worker = registration.installing;
			if (!worker) return;
			worker.addEventListener('statechange', () => {
				if (worker.state === 'installed') maybeSkipWaiting();
			});
		});

		return {
			supported,
			registered: true,
			controlled: Boolean(navigator.serviceWorker.controller),
			scope: registration.scope
		};
	} catch (error) {
		return {
			supported,
			registered: false,
			controlled: Boolean(navigator.serviceWorker.controller),
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
