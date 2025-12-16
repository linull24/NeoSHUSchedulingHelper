export type QueryLayerEngine = 'auto' | 'duckdb' | 'sqljs';

export interface QueryLayerConfig {
	engine: QueryLayerEngine;
	lazyInit: boolean;
	/**
	 * When true, do not fallback if the requested engine fails to initialize.
	 * Defaults to false so we can gracefully degrade when WASM/Worker is unavailable.
	 */
	strictEngine: boolean;
}

const DEFAULT_CONFIG: QueryLayerConfig = {
	engine: resolveEngine(import.meta.env?.VITE_QUERY_LAYER_ENGINE),
	lazyInit: true,
	strictEngine: resolveBool(import.meta.env?.VITE_QUERY_LAYER_STRICT_ENGINE)
};

export function getQueryLayerConfig(overrides?: Partial<QueryLayerConfig>): QueryLayerConfig {
	return {
		...DEFAULT_CONFIG,
		...overrides
	};
}

function resolveEngine(raw?: string): QueryLayerEngine {
	if (!raw) return 'auto';
	const normalized = raw.toLowerCase();
	if (normalized === 'duckdb') return 'duckdb';
	if (normalized === 'sqljs' || normalized === 'sqlite' || normalized === 'fallback') return 'sqljs';
	return 'auto';
}

function resolveBool(raw?: string): boolean {
	if (!raw) return false;
	const normalized = raw.toLowerCase();
	return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
