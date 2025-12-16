import { createJwxtHttpClient } from './client';
import { buildQueryContext, buildSelectionIndexUrl, parseSelectionPageFields } from './selectionContext';
import type { JwxtSession } from './sessionStore';

export async function refreshSelectionContext(session: JwxtSession) {
	const client = createJwxtHttpClient(session.jar);
	const selectionRes = await client.fetch(buildSelectionIndexUrl(), { method: 'GET' });
	if (selectionRes.status !== 200) {
		throw new Error(`Failed to load selection page (${selectionRes.status})`);
	}
	const html = await selectionRes.text();
	const fields = parseSelectionPageFields(html);
	const context = buildQueryContext(fields);
	session.fields = fields;
	session.context = context;
	return context;
}

