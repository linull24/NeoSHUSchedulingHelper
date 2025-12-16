import { randomBytes, randomUUID } from 'node:crypto';
import { CookieJar } from './cookieJar';

export type JwxtSession = {
	id: string;
	createdAt: number;
	updatedAt: number;
	account?: { userId: string; displayName?: string };
	jar: CookieJar;
	context?: Record<string, string>;
	fields?: Record<string, string>;
};

const sessions = new Map<string, JwxtSession>();

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

function now() {
	return Date.now();
}

function randomId(): string {
	if (typeof randomUUID === 'function') return randomUUID();
	return randomBytes(16).toString('hex');
}

export function getSession(sessionId: string | undefined): JwxtSession | null {
	if (!sessionId) return null;
	const existing = sessions.get(sessionId);
	if (!existing) return null;
	if (now() - existing.updatedAt > SESSION_TTL_MS) {
		sessions.delete(sessionId);
		return null;
	}
	return existing;
}

export function createSession(): JwxtSession {
	const id = randomId();
	const createdAt = now();
	const session: JwxtSession = {
		id,
		createdAt,
		updatedAt: createdAt,
		jar: new CookieJar()
	};
	sessions.set(id, session);
	return session;
}

export function touchSession(session: JwxtSession) {
	session.updatedAt = now();
}

export function destroySession(sessionId: string | undefined) {
	if (!sessionId) return;
	sessions.delete(sessionId);
}

export function cleanupExpiredSessions() {
	const cutoff = now() - SESSION_TTL_MS;
	for (const [id, session] of sessions.entries()) {
		if (session.updatedAt < cutoff) sessions.delete(id);
	}
}
