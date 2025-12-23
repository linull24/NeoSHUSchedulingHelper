export interface GistSyncConfig {
	gistId?: string;
	token: string;
	files: Record<string, string>;
	description?: string;
	public?: boolean;
}

const API_ROOT = 'https://api.github.com';

export interface GistFileContent {
	filename: string;
	content: string;
}

type GistListItem = {
	id: string;
	html_url?: string;
	description?: string | null;
	updated_at?: string;
	files?: Record<string, { filename?: string } | undefined>;
};

async function fetchJson<T>(url: string, token: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Authorization: `token ${token}`,
			Accept: 'application/vnd.github+json'
		}
	});
	if (!response.ok) {
		const error = await response.text().catch(() => '');
		throw new Error(`GitHub API 请求失败: ${response.status} ${response.statusText} - ${error}`);
	}
	return (await response.json()) as T;
}

export async function findLatestGistId(config: {
	token: string;
	filename: string;
	descriptionIncludes?: string;
	maxPages?: number;
}): Promise<string | null> {
	const maxPages = Math.max(1, Math.min(10, config.maxPages ?? 5));
	const needle = String(config.descriptionIncludes || '').trim();

	let best: { id: string; updatedAt: number } | null = null;
	for (let page = 1; page <= maxPages; page++) {
		const list = await fetchJson<GistListItem[]>(`${API_ROOT}/gists?per_page=100&page=${page}`, config.token);
		if (!Array.isArray(list) || list.length === 0) break;

		for (const gist of list) {
			const id = String(gist?.id || '').trim();
			if (!id) continue;
			const files = gist?.files ?? {};
			if (!files || typeof files !== 'object') continue;
			if (!Object.prototype.hasOwnProperty.call(files, config.filename)) continue;

			if (needle) {
				const desc = String(gist?.description || '');
				if (!desc.includes(needle)) continue;
			}

			const updatedAt = gist?.updated_at ? Date.parse(gist.updated_at) : 0;
			const score = Number.isFinite(updatedAt) ? updatedAt : 0;
			if (!best || score > best.updatedAt) best = { id, updatedAt: score };
		}
	}

	return best?.id ?? null;
}

export async function syncGist(config: GistSyncConfig) {
	const body = {
		description: config.description ?? 'SHU Course Scheduler data',
		public: config.public ?? false,
		files: Object.fromEntries(Object.entries(config.files).map(([name, content]) => [name, { content }]))
	};

	const headers = {
		Authorization: `token ${config.token}`,
		'Content-Type': 'application/json',
		Accept: 'application/vnd.github+json'
	};

	const endpoint = config.gistId ? `${API_ROOT}/gists/${config.gistId}` : `${API_ROOT}/gists`;
	const method = config.gistId ? 'PATCH' : 'POST';
	const response = await fetch(endpoint, {
		method,
		headers,
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Gist 同步失败: ${response.status} ${response.statusText} - ${error}`);
	}

	const result = (await response.json()) as { id: string };
	return {
		id: result.id,
		url: `https://gist.github.com/${result.id}`
	};
}

export async function getGistFileContent(config: { gistId: string; token?: string; filename: string }): Promise<GistFileContent> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json'
	};
	if (config.token) headers.Authorization = `token ${config.token}`;

	const response = await fetch(`${API_ROOT}/gists/${config.gistId}`, { headers });
	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Gist 拉取失败: ${response.status} ${response.statusText} - ${error}`);
	}

	const gist = (await response.json()) as {
		files?: Record<
			string,
			{ filename?: string; content?: string; truncated?: boolean; raw_url?: string | null } | undefined
		>;
	};
	const file = gist.files?.[config.filename];
	if (!file) throw new Error(`Gist 缺少文件: ${config.filename}`);

	if (typeof file.content === 'string' && file.truncated !== true) {
		return { filename: config.filename, content: file.content };
	}

	const rawUrl = typeof file.raw_url === 'string' ? file.raw_url : null;
	if (!rawUrl) throw new Error(`Gist 文件内容被截断且没有 raw_url: ${config.filename}`);

	const rawResp = await fetch(rawUrl, { headers: config.token ? { Authorization: `token ${config.token}` } : undefined });
	if (!rawResp.ok) {
		const error = await rawResp.text();
		throw new Error(`Gist raw 拉取失败: ${rawResp.status} ${rawResp.statusText} - ${error}`);
	}
	return { filename: config.filename, content: await rawResp.text() };
}
