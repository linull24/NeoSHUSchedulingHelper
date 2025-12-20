export { parseHiddenInputsByName } from '../../../../shared/jwxtCrawler/forms';

export function parseFirstFormAction(html: string): string | null {
	const re = /<form\b[^>]*\baction\s*=\s*("([^"]*)"|'([^']*)')/i;
	const match = re.exec(html);
	const action = (match?.[2] ?? match?.[3] ?? '').trim();
	return action ? action : null;
}
