import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { buildSsoEntryUrl } from '../../../../lib/server/jwxt/selectionContext';

export const GET: RequestHandler = async () => {
	try {
		const entryUrl = buildSsoEntryUrl();
		const entryRes = await fetch(entryUrl, { method: 'GET', redirect: 'manual' });
		const location = entryRes.headers.get('location');
		const finalUrl = location ? new URL(location, entryRes.url).toString() : undefined;
		return json({
			ok: true,
			supported: true,
			ssoEntryStatus: entryRes.status,
			finalUrl,
			message: entryRes.status === 302 ? 'ok' : 'unexpected status'
		});
	} catch (error) {
		return json(
			{
				ok: false,
				supported: true,
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
