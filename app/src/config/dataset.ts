export interface DatasetConfig {
	/**
	 * Term identifier.
	 *
	 * Frontend will load `/crawler/data/terms/<termId>.json` as the raw snapshot (served from static assets).
	 */
	termId: string;
	/**
	 * Absolute or relative path pointing to the crawler snapshot JSON.
	 * Informational only (for debugging / human reference).
	 */
	snapshotPath: string;
	/**
	 * Optional parser identifier; defaults to automatic detection via term name.
	 */
	parserId?: string;
	/**
	 * Optional list of course IDs that should be pre-selected on first load.
	 * These IDs must match entries produced by the dataset transformer.
	 */
	seedSelectionIds?: string[];
}

const DEFAULT_DATASET_CONFIG: DatasetConfig = {
	termId: '2025-16',
	// Leave empty by default; runtime resolver will pick the latest matching term from
	// `static/crawler/data/current.json` (bundled into SSG builds).
	snapshotPath: '',
	parserId: '2025Spring',
	seedSelectionIds: []
};

export function getDatasetConfig(overrides?: Partial<DatasetConfig>): DatasetConfig {
	return {
		...DEFAULT_DATASET_CONFIG,
		...overrides,
		seedSelectionIds: overrides?.seedSelectionIds ?? DEFAULT_DATASET_CONFIG.seedSelectionIds
	};
}
