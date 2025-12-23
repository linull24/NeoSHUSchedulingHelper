import { writable } from 'svelte/store';

const TOKEN_KEY = 'githubToken';

function readInitialToken() {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

const tokenStore = writable<string | null>(readInitialToken());

if (typeof window !== 'undefined') {
	tokenStore.subscribe((value) => {
		try {
			if (value) {
				localStorage.setItem(TOKEN_KEY, value);
			} else {
				localStorage.removeItem(TOKEN_KEY);
			}
		} catch {
			// ignore
		}
	});

	window.addEventListener('storage', (event) => {
		if (event.key !== TOKEN_KEY) return;
		const next = typeof event.newValue === 'string' ? event.newValue : null;
		tokenStore.set(next && next.trim() ? next : null);
	});
}

export const githubToken = tokenStore;

export function setGithubToken(token: string) {
	githubToken.set(String(token || '').trim() || null);
}

export function clearGithubToken() {
	githubToken.set(null);
}
