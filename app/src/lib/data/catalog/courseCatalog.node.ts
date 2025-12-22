import type { RawJwxtCourseSnapshot } from '../InsaneCourseParser';

type CurrentManifestEntry = {
	termId: string;
	termCode?: string;
	jwxtRound?: { xklc?: string | number };
	generatedAt?: number;
};

const RAW_SNAPSHOT_MODULES = import.meta.glob('../../../../static/crawler/data/terms/*.json', {
	eager: true,
	import: 'default'
});

const CURRENT_MANIFEST_MODULE = import.meta.glob('../../../../static/crawler/data/current.json', {
	eager: true,
	import: 'default'
});

function pickBestTermIdFromManifest(termIdOrCode: string, manifest: CurrentManifestEntry[]): string | null {
	const candidates = manifest
		.filter((entry) => {
			const termId = String(entry.termId || '').trim();
			const termCode = String(entry.termCode || '').trim();
			if (!termId) return false;
			if (termId === termIdOrCode) return true;
			if (termCode && termCode === termIdOrCode) return true;
			if (termId.startsWith(`${termIdOrCode}--xkkz-`)) return true;
			return false;
		})
		.map((entry) => {
			const xklcRaw = entry.jwxtRound?.xklc ?? '';
			const xklc = Number.parseInt(String(xklcRaw || '0'), 10);
			const generatedAt = typeof entry.generatedAt === 'number' ? entry.generatedAt : 0;
			return {
				termId: String(entry.termId || '').trim(),
				xklc: Number.isFinite(xklc) ? xklc : 0,
				generatedAt
			};
		})
		.filter((entry) => entry.termId.length > 0);

	if (!candidates.length) return null;
	candidates.sort((a, b) => (b.xklc - a.xklc) || (b.generatedAt - a.generatedAt));
	return candidates[0]!.termId;
}

export function resolveRawSnapshot(termIdOrCode: string): RawJwxtCourseSnapshot {
	const suffix = `/crawler/data/terms/${termIdOrCode}.json`;
	for (const [path, value] of Object.entries(RAW_SNAPSHOT_MODULES)) {
		if (path.endsWith(suffix)) return value as RawJwxtCourseSnapshot;
	}

	const manifestValues = Object.values(CURRENT_MANIFEST_MODULE) as unknown[];
	const manifest = (manifestValues[0] ?? []) as CurrentManifestEntry[];
	const best = pickBestTermIdFromManifest(termIdOrCode, Array.isArray(manifest) ? manifest : []);
	if (best) {
		const bestSuffix = `/crawler/data/terms/${best}.json`;
		for (const [path, value] of Object.entries(RAW_SNAPSHOT_MODULES)) {
			if (path.endsWith(bestSuffix)) return value as RawJwxtCourseSnapshot;
		}
	}

	// Last resort: try round-prefix match within already-imported snapshots.
	const roundPrefix = `/crawler/data/terms/${termIdOrCode}--xkkz-`;
	const candidates: Array<{ snapshot: RawJwxtCourseSnapshot; xklc: number; updatedAt: number }> = [];
	for (const [path, value] of Object.entries(RAW_SNAPSHOT_MODULES)) {
		if (!path.includes(roundPrefix)) continue;
		const snapshot = value as RawJwxtCourseSnapshot;
		const xklcRaw = String(snapshot?.jwxtRound?.xklc ?? '').trim();
		const xklcNum = Number.parseInt(xklcRaw || '0', 10);
		const updatedAt = typeof snapshot?.updateTimeMs === 'number' ? snapshot.updateTimeMs : 0;
		candidates.push({
			snapshot,
			xklc: Number.isFinite(xklcNum) ? xklcNum : 0,
			updatedAt
		});
	}
	if (candidates.length) {
		candidates.sort((a, b) => (b.xklc - a.xklc) || (b.updatedAt - a.updatedAt));
		return candidates[0]!.snapshot;
	}

	throw new Error(`未找到学期 ${termIdOrCode} 的原始快照文件（node resolver）`);
}

