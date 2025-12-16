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
