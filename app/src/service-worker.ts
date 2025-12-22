/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = `app-cache-${version}`;
const ASSETS = [...build, ...files, ...prerendered];

const BASE_PATH = (() => {
	const scope = new URL(self.registration.scope);
	return scope.pathname.endsWith('/') ? scope.pathname.slice(0, -1) : scope.pathname;
})();

function joinPath(base: string, suffix: string) {
	const left = String(base || '').replace(/\/+$/, '');
	const right = String(suffix || '').replace(/^\/+/, '');
	if (!left) return `/${right}`;
	return `${left}/${right}`;
}

function withIsolationHeaders(response: Response) {
	const cloned = response.clone();
	const headers = new Headers(cloned.headers);
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return new Response(cloned.body, {
		status: cloned.status,
		statusText: cloned.statusText,
		headers
	});
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			try {
				await cache.addAll(ASSETS);
			} catch {
				await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
			}
		})()
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);

			const cached = await cache.match(event.request);
			if (cached) return withIsolationHeaders(cached);

			const crawlerPrefix = joinPath(BASE_PATH, 'crawler/data/');
			try {
				const response = await fetch(event.request);
				if (response.ok && (ASSETS.includes(url.pathname) || url.pathname.startsWith(crawlerPrefix))) {
					cache.put(event.request, response.clone()).catch(() => {});
				}
				return withIsolationHeaders(response);
			} catch {
				if (event.request.mode === 'navigate') {
					const fallback = await cache.match(`${BASE_PATH}/`);
					if (fallback) return withIsolationHeaders(fallback);
				}
				return new Response('offline', { status: 503, statusText: 'Offline' });
			}
		})()
	);
});
