import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type JwxtIoLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type JwxtIoLogEntry = {
	id: string;
	at: number;
	level: JwxtIoLogLevel;
	message: string;
	meta?: Record<string, unknown>;
};

const PAGE_BRIDGE_CHANNEL = 'shuosc-jwxt-userscript-bridge-v1';
const MAX_LOGS = 400;

function clampMessage(raw: unknown) {
	const text = String(raw ?? '').trim();
	if (text.length <= 1200) return text;
	return `${text.slice(0, 1200)}…`;
}

function randomId() {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeMeta(raw: unknown): Record<string, unknown> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		const k = String(key || '').toLowerCase();
		if (!k) continue;
		if (k.includes('password') || k.includes('cookie') || k.includes('token') || k.includes('secret')) continue;
		out[key] = value;
	}
	return Object.keys(out).length ? out : undefined;
}

export const jwxtIoLogs = writable<JwxtIoLogEntry[]>([]);

export function clearJwxtIoLogs() {
	jwxtIoLogs.set([]);
}

if (browser) {
	window.addEventListener(
		'message',
		(event) => {
			try {
				if (event.source !== window) return;
				const msg: any = event.data;
				if (!msg || msg.__channel !== PAGE_BRIDGE_CHANNEL || msg.type !== 'log') return;

				const level = (String(msg.level || 'info').trim() || 'info') as JwxtIoLogLevel;
				const entry: JwxtIoLogEntry = {
					id: randomId(),
					at: Date.now(),
					level: level === 'debug' || level === 'info' || level === 'warn' || level === 'error' ? level : 'info',
					message: clampMessage(msg.message),
					meta: sanitizeMeta(msg.meta)
				};

				jwxtIoLogs.update((prev) => {
					const next = prev.length >= MAX_LOGS ? prev.slice(prev.length - MAX_LOGS + 1) : prev.slice();
					next.push(entry);
					return next;
				});
			} catch {
				// ignore
			}
		},
		{ passive: true }
	);
}
