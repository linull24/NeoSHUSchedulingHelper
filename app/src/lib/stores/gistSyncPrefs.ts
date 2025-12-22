import { writable } from 'svelte/store';

const GIST_ID_KEY = 'githubGistId';

function readInitialGistId() {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(GIST_ID_KEY);
		return raw?.trim() ? raw : null;
	} catch {
		return null;
	}
}

const gistIdStore = writable<string | null>(readInitialGistId());

if (typeof window !== 'undefined') {
	gistIdStore.subscribe((value) => {
		try {
			if (value) localStorage.setItem(GIST_ID_KEY, value);
			else localStorage.removeItem(GIST_ID_KEY);
		} catch {
			// ignore
		}
	});
}

export const githubGistId = gistIdStore;

export function setGithubGistId(gistId: string) {
	const trimmed = gistId.trim();
	githubGistId.set(trimmed || null);
}

export function clearGithubGistId() {
	githubGistId.set(null);
}

