export interface RemoteCrawlerFiles {
	/**
	 * URL/path to `current.json`.
	 *
	 * Examples:
	 * - `/crawler/data/current.json`
	 * - `https://raw.githubusercontent.com/<user>/<repo>/<branch>/crawler/data/current.json`
	 */
	currentUrl: string;
	/**
	 * Base URL/path to `terms/` directory (must end with `/` or will be normalized).
	 *
	 * Examples:
	 * - `/crawler/data/terms/`
	 * - `https://<bucket-or-cdn>/crawler/data/terms/`
	 */
	termsBaseUrl: string;
}

export interface CrawlerSourceConfig {
	id: string;
	localRoot: string;
	termsDir: string;
	indexFile: string;
	remote?: RemoteCrawlerFiles;
}

export interface TermIndexEntry {
	id: string;
	file: string;
	hash: string;
	updatedAt: number;
	size?: number;
	notes?: string;
}

export type CrawlerConfigOverrides = Partial<Omit<CrawlerSourceConfig, 'remote'>> & {
	remote?: RemoteCrawlerFiles | null;
};

function readEnvNonEmpty(key: string): string | undefined {
	const raw = (import.meta as any)?.env?.[key];
	if (typeof raw !== 'string') return undefined;
	const trimmed = raw.trim();
	return trimmed ? trimmed : undefined;
}

function joinPath(root: string, ...parts: string[]) {
	let out = root;
	for (const part of parts) {
		if (!part) continue;
		out = out.replace(/\/+$/, '');
		out += `/${part.replace(/^\/+/, '')}`;
	}
	return out;
}

function resolveLocalCrawlerRoot() {
	const configured = (readEnvNonEmpty('VITE_CRAWLER_ROOT') ?? '../static').replace(/\/+$/, '');
	return configured.endsWith('/crawler') ? configured : joinPath(configured, 'crawler');
}

function resolveDefaultRemoteFiles(): RemoteCrawlerFiles | undefined {
	const currentUrl = readEnvNonEmpty('VITE_CRAWLER_CURRENT_URL');
	const termsBaseUrl = readEnvNonEmpty('VITE_CRAWLER_TERMS_BASE_URL');
	if (!currentUrl || !termsBaseUrl) return undefined;
	return { currentUrl, termsBaseUrl };
}

const DEFAULT_CONFIG: CrawlerSourceConfig = {
	id: 'local-monorepo',
	localRoot: resolveLocalCrawlerRoot(),
	termsDir: 'data/terms',
	indexFile: 'data/terms/index.json',
	remote: undefined
};

export function getCrawlerConfig(overrides?: CrawlerConfigOverrides): CrawlerSourceConfig {
	const defaultRemote = resolveDefaultRemoteFiles();

	const remote =
		overrides?.remote === undefined
			? defaultRemote
			: overrides.remote === null
				? undefined
				: { ...defaultRemote, ...overrides.remote };
	return {
		...DEFAULT_CONFIG,
		...overrides,
		remote
	};
}

export function resolveTermFile(termId: string, config: CrawlerSourceConfig = DEFAULT_CONFIG) {
	return joinPath(config.localRoot, config.termsDir, `${termId}.json`);
}

export function resolveIndexFile(config: CrawlerSourceConfig = DEFAULT_CONFIG) {
	return joinPath(config.localRoot, config.indexFile);
}
