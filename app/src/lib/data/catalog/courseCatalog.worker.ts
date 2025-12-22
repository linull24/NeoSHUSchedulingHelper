import { resolveParser } from '../parsers';
import type { RawJwxtCourseSnapshot } from '../InsaneCourseParser';
import { InsaneCourseData, type CourseDatasetPayload } from '../InsaneCourseData';

type Request =
	| { type: 'parse'; snapshotText: string }
	| { type: 'ping' };

type Response =
	| { ok: true; type: 'pong' }
	| { ok: true; type: 'parsed'; payload: CourseDatasetPayload; parser: { id: string; version: string }; termName: string }
	| { ok: false; error: string };

function post(msg: Response) {
	(self as any).postMessage(msg);
}

function toErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

(self as any).onmessage = (event: MessageEvent<Request>) => {
	const message = event.data;
	if (!message || typeof message !== 'object') return;
	if (message.type === 'ping') {
		post({ ok: true, type: 'pong' });
		return;
	}
	if (message.type !== 'parse') return;

	try {
		const raw = JSON.parse(String(message.snapshotText || '')) as RawJwxtCourseSnapshot;
		const termName = String((raw as any)?.termName || '').trim();
		if (!termName) {
			post({ ok: false, error: 'SNAPSHOT_TERMNAME_MISSING' });
			return;
		}
		const parser = resolveParser(termName);
		if (!parser) {
			post({ ok: false, error: `PARSER_NOT_FOUND:${termName}` });
			return;
		}
		const data = parser.parse(raw) as InsaneCourseData;
		post({ ok: true, type: 'parsed', payload: data.payload, parser: { id: parser.id, version: parser.version }, termName });
	} catch (error) {
		post({ ok: false, error: toErrorMessage(error) });
	}
};
