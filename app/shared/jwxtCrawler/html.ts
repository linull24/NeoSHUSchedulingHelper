export function decodeHtml(text: string): string {
	return String(text || '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/g, "'");
}

export function stripHtml(text: string): string {
	return decodeHtml(String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export type JwxtSelectOption = { value: string; label: string; selected: boolean };

export function isJwxtLocalLoginUrl(url: string): boolean {
	const text = String(url || '').toLowerCase();
	return text.includes('/jwglxt/xtgl/login_slogin.html');
}

export function looksLikeJwxtLocalLoginHtml(html: string): boolean {
	const text = String(html || '').toLowerCase();
	// Local login page usually includes csrftoken + yhm/mm inputs.
	//
	// NOTE: Do NOT rely on the substring `login_slogin` alone — many normal pages may reference
	// the login URL in scripts/links, which would create false positives and break login probes.
	const hasCsrf = /\bname\s*=\s*["']?csrftoken\b/i.test(text);
	const hasUser = /\bname\s*=\s*["']?yhm\b/i.test(text) || /\bid\s*=\s*["']?yhm\b/i.test(text);
	const hasPass = /\bname\s*=\s*["']?mm\b/i.test(text) || /\bid\s*=\s*["']?mm\b/i.test(text);
	return hasCsrf && hasUser && hasPass;
}

export function parseSelectOptions(
	html: string,
	selectId: string
): JwxtSelectOption[] {
	const escaped = selectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const selectRe = new RegExp(
		`<select\\b[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/select>`,
		'i'
	);
	const selectMatch = selectRe.exec(html);
	if (!selectMatch) return [];
	const inner = selectMatch[1] || '';

	const options: JwxtSelectOption[] = [];
	const optionRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
	let match: RegExpExecArray | null;
	while ((match = optionRe.exec(inner)) !== null) {
		const attrsRaw = match[1] || '';
		const labelRaw = match[2] || '';
		const attrRe = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
		const attrs: Record<string, string> = {};
		let m: RegExpExecArray | null;
		while ((m = attrRe.exec(`<option ${attrsRaw}>`)) !== null) {
			const key = m[1];
			const value = m[3] != null ? m[3] : m[4] != null ? m[4] : '';
			attrs[key] = value;
		}
		const value = attrs.value != null ? attrs.value : '';
		const selected = /\bselected\b/i.test(attrsRaw);
		const label = stripHtml(labelRaw);
		options.push({ value, label, selected });
	}
	return options;
}
