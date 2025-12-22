import { createJwxtHttpClient } from './client';
import {
	buildSelectionDisplayUrl,
	buildSelectionIndexUrl,
	parseSelectionIndexHtml,
	buildSelectionDisplayPayload,
	mergeSelectionDisplayHtml,
	finalizeSelectionContext
} from './selectionContext';
import type { JwxtSession } from './sessionStore';
import { isJwxtLocalLoginUrl, looksLikeJwxtLocalLoginHtml } from '../../../../shared/jwxtCrawler/html';

function isDebugEnabled(): boolean {
	const raw = String(process?.env?.JWXT_DEBUG ?? '').trim().toLowerCase();
	return ['1', 'true', 'yes', 'on'].includes(raw);
}

export async function refreshSelectionContext(session: JwxtSession) {
	const client = createJwxtHttpClient(session.jar);
	const selectionIndexUrl = buildSelectionIndexUrl();
	const selectionRes0 = await client.fetch(selectionIndexUrl, { method: 'GET' });
	const selectionRes = await client.followRedirects(selectionRes0, 10);
	if (selectionRes.status !== 200) {
		throw new Error(`Failed to load selection page (${selectionRes.status})`);
	}
	if (selectionRes.url.includes('/sso/') || selectionRes.url.includes('newsso.shu.edu.cn')) {
		throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
	}
	if (isJwxtLocalLoginUrl(selectionRes.url)) {
		throw new Error(`Selection page redirected to JWXT local login (${selectionRes.url})`);
	}
	const indexHtml = await selectionRes.text();
	if (looksLikeJwxtLocalLoginHtml(indexHtml)) {
		throw new Error('Selection page is JWXT local login HTML (session invalid)');
	}
	const parsed = parseSelectionIndexHtml({ indexHtml, preferredXkkzId: session.selectedXkkzId || null });
	const tabs = parsed.tabs;
	const selectedTab = parsed.selectedTab;
	let mergedFields = parsed.mergedFieldsBase;

	if (selectedTab) {
		const displayUrl = buildSelectionDisplayUrl();
		const payload = buildSelectionDisplayPayload({ indexFields: parsed.indexFields, selectedTab });
		const displayRes = await client.fetch(displayUrl, {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: selectionIndexUrl
			},
			body: payload
		});
		const displayFinal = await client.followRedirects(displayRes, 10);
		if (isDebugEnabled()) {
			// eslint-disable-next-line no-console
			console.warn('[jwxt] display status', { status: displayFinal.status, url: displayFinal.url });
		}
		if (displayFinal.status === 200) {
			const displayHtml = await displayFinal.text();
			const merged = mergeSelectionDisplayHtml({ mergedFieldsBase: mergedFields, displayHtml });
			mergedFields = merged.mergedFields;
			if (merged.campusOptions.length) session.campusOptions = merged.campusOptions;

			if (isDebugEnabled() && (!mergedFields.xklc || !mergedFields.xklcmc)) {
				const idx = displayHtml.toLowerCase().indexOf('xklc');
				const snippet = idx >= 0 ? displayHtml.slice(Math.max(0, idx - 120), Math.min(displayHtml.length, idx + 260)) : '';
				// eslint-disable-next-line no-console
				console.warn('[jwxt] display round meta missing', {
					has_xklc_input: /\bid\s*=\s*("xklc"|'xklc'|xklc)\b/i.test(displayHtml) || /\bname\s*=\s*("xklc"|'xklc'|xklc)\b/i.test(displayHtml),
					has_xklcmc_input:
						/\bid\s*=\s*("xklcmc"|'xklcmc'|xklcmc)\b/i.test(displayHtml) ||
						/\bname\s*=\s*("xklcmc"|'xklcmc'|xklcmc)\b/i.test(displayHtml),
					snippet
				});
			}
		}
	}

	const finalized = finalizeSelectionContext({ mergedFields, tabs, activeXkkzId: parsed.activeXkkzId });
	session.fields = finalized.fields;
	session.context = finalized.context;
	session.roundTabs = tabs;
	session.activeXkkzId = finalized.activeXkkzId || null;
	session.currentXkkzId = finalized.currentXkkzId;
	return session.context;
}
