type ParsedInput = {
	name?: string;
	value?: string;
	type?: string;
};

function findAllInputTags(html: string): string[] {
	const tags: string[] = [];
	const re = /<input\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		tags.push(match[0]);
	}
	return tags;
}

function parseAttributes(tag: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(tag)) !== null) {
		const key = match[1].toLowerCase();
		const value = match[3] ?? match[4] ?? '';
		out[key] = value;
	}
	return out;
}

function parseInputTag(tag: string): ParsedInput {
	const attrs = parseAttributes(tag);
	return {
		name: attrs.name,
		value: attrs.value,
		type: attrs.type
	};
}

export function parseHiddenInputsByName(html: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const tag of findAllInputTags(html)) {
		const input = parseInputTag(tag);
		if (!input.name) continue;
		if (input.type && input.type.toLowerCase() !== 'hidden') continue;
		out[input.name] = input.value ?? '';
	}
	return out;
}

