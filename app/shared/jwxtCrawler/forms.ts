export function parseHiddenInputsByName(html: string): Record<string, string> {
	const result: Record<string, string> = {};
	const re = /<input\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		const tag = match[0];
		const attrs: Record<string, string> = {};
		const quotedAttrRe = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
		const unquotedAttrRe = /([a-zA-Z0-9:_-]+)\s*=\s*([^\s"'=<>`]+)/g;
		let m: RegExpExecArray | null;
		while ((m = quotedAttrRe.exec(tag)) !== null) {
			const key = m[1].toLowerCase();
			const value = m[3] != null ? m[3] : m[4] != null ? m[4] : '';
			attrs[key] = value;
		}
		while ((m = unquotedAttrRe.exec(tag)) !== null) {
			const key = String(m[1] || '').toLowerCase();
			if (attrs[key] != null) continue;
			const value = m[2] != null ? m[2] : '';
			attrs[key] = value;
		}
		const name = attrs.name;
		const type = attrs.type;
		if (name && (!type || type.toLowerCase() === 'hidden')) {
			result[name] = attrs.value != null ? attrs.value : '';
		}
	}
	return result;
}

export function parseFormAction(html: string): string | null {
	try {
		const match = /<form\b[^>]*action\s*=\s*("([^"]+)"|'([^']+)')/i.exec(html);
		const action = (match && (match[2] || match[3]) ? String(match[2] || match[3]) : '').trim();
		return action || null;
	} catch {
		return null;
	}
}
