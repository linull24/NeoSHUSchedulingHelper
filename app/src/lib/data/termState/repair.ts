import { courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import { getDatasetSig } from './datasetSig';
import type { ActionEntryV1, EpochMs, GroupKey, TermState } from './types';

export interface DatasetResolveRepair {
	ok: true;
	state: TermState;
	didRepair: boolean;
}

function nowEpochMs(): EpochMs {
	return Date.now() as EpochMs;
}

function appendHistory(state: TermState, entry: ActionEntryV1): TermState {
	const kept = state.history.entries.slice(0, state.history.cursor + 1);
	return {
		...state,
		history: {
			...state.history,
			cursor: kept.length,
			entries: [...kept, entry]
		}
	};
}

let cachedGroupKeyCounts: Map<string, number> | null = null;

function getGroupKeyCandidateCounts(): Map<string, number> {
	if (cachedGroupKeyCounts) return cachedGroupKeyCounts;
	const counts = new Map<string, number>();
	for (const entry of courseCatalogMap.values()) {
		const key = deriveGroupKey(entry) as unknown as string;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	cachedGroupKeyCounts = counts;
	return counts;
}

function candidateCount(groupKey: GroupKey): number {
	return getGroupKeyCandidateCounts().get(groupKey as unknown as string) ?? 0;
}

function downgradeGranularity(settings: TermState['settings']): TermState['settings'] {
	return {
		...settings,
		granularity: {
			...settings.granularity,
			allCourses: 'sectionOnly',
			candidates: 'sectionOnly',
			solver: 'sectionOnly'
		}
	};
}

function buildIssueKey(input: {
	datasetSigBefore: string;
	datasetSigAfter: string;
	changedGroups: Array<{ groupKey: GroupKey; prevCount: number | null; nextCount: number }>;
	removedWishlistGroups: GroupKey[];
	removedStagingGroups: GroupKey[];
	removedSelectedCount: number;
	removedWishlistSectionCount: number;
	removedStagingSectionCount: number;
}): string {
	const changed = input.changedGroups
		.slice()
		.sort((a, b) => (a.groupKey as unknown as string).localeCompare(b.groupKey as unknown as string))
		.map((item) => `${item.groupKey}:${item.prevCount ?? 'unknown'}->${item.nextCount}`)
		.join('|');
	const removedWishlist = input.removedWishlistGroups
		.slice()
		.sort((a, b) => (a as unknown as string).localeCompare(b as unknown as string))
		.join('|');
	const removedStaging = input.removedStagingGroups
		.slice()
		.sort((a, b) => (a as unknown as string).localeCompare(b as unknown as string))
		.join('|');
	return `sig:${input.datasetSigBefore}->${input.datasetSigAfter}|changed:${changed}|rmW:${removedWishlist}|rmS:${removedStaging}|rmSel:${input.removedSelectedCount}|rmWs:${input.removedWishlistSectionCount}|rmSs:${input.removedStagingSectionCount}`;
}

export function repairDatasetResolve(state: TermState): DatasetResolveRepair {
	const datasetSigBefore = state.dataset.sig;
	const datasetSigAfter = getDatasetSig(state.termId as unknown as string);
	const didDatasetSigChange = datasetSigBefore !== datasetSigAfter;

	const removedSelected = state.selection.selected.filter((id) => !courseCatalogMap.has(id as unknown as string));
	const removedWishlistSections = state.selection.wishlistSections.filter((id) => !courseCatalogMap.has(id as unknown as string));
	const nextSelected = state.selection.selected.filter((id) => courseCatalogMap.has(id as unknown as string));
	const nextWishlistSections = state.selection.wishlistSections.filter((id) => courseCatalogMap.has(id as unknown as string));

	const removedStagingSections: string[] = [];
	const nextStaging = state.solver.staging.filter((item) => {
		if (item.kind === 'group') return true;
		const ok = courseCatalogMap.has(item.key as unknown as string);
		if (!ok) removedStagingSections.push(item.key as unknown as string);
		return ok;
	});

	const baselineCounts = state.dataset.groupKeyCounts ?? {};

	const trackedGroupKeys = new Set<string>();
	for (const key of state.selection.wishlistGroups) trackedGroupKeys.add(key as unknown as string);
	for (const item of nextStaging) {
		if (item.kind === 'group') trackedGroupKeys.add(item.key as unknown as string);
		if (item.kind === 'section') {
			const entry = courseCatalogMap.get(item.key as unknown as string);
			if (entry) trackedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
		}
	}
	for (const entryId of nextSelected as unknown as string[]) {
		const entry = courseCatalogMap.get(entryId);
		if (entry) trackedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
	}
	for (const entryId of nextWishlistSections as unknown as string[]) {
		const entry = courseCatalogMap.get(entryId);
		if (entry) trackedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
	}

	const removedWishlistGroups = state.selection.wishlistGroups.filter((key) => candidateCount(key) === 0);
	const nextWishlistGroups = state.selection.wishlistGroups.filter((key) => candidateCount(key) > 0);

	const removedStagingGroups: GroupKey[] = [];
	const nextStagingWithoutMissingGroups = nextStaging.filter((item) => {
		if (item.kind !== 'group') return true;
		const ok = candidateCount(item.key) > 0;
		if (!ok) removedStagingGroups.push(item.key);
		return ok;
	});

	const changedGroups: Array<{ groupKey: GroupKey; prevCount: number | null; nextCount: number }> = [];
	for (const groupKey of trackedGroupKeys) {
		const prevCount = Object.prototype.hasOwnProperty.call(baselineCounts, groupKey)
			? (baselineCounts[groupKey] as number)
			: null;
		const nextCount = candidateCount(groupKey as any);
		if (prevCount === null) {
			if (didDatasetSigChange) {
				changedGroups.push({ groupKey: groupKey as any, prevCount: null, nextCount });
			}
			continue;
		}
		if (prevCount !== nextCount) {
			changedGroups.push({ groupKey: groupKey as any, prevCount, nextCount });
		}
	}

	const hasIssues =
		didDatasetSigChange ||
		changedGroups.length > 0 ||
		removedWishlistGroups.length > 0 ||
		removedStagingGroups.length > 0 ||
		removedSelected.length > 0 ||
		removedWishlistSections.length > 0 ||
		removedStagingSections.length > 0;

	let next: TermState = state;
	let didRepair = false;

	if (didDatasetSigChange) {
		didRepair = true;
		next = {
			...next,
			dataset: {
				...next.dataset,
				sig: datasetSigAfter,
				loadedAt: nowEpochMs()
			},
			jwxt:
				next.jwxt.syncState === 'FROZEN'
					? { ...next.jwxt, baseline: null, pushTicket: null }
					: { syncState: 'NEEDS_PULL', baseline: null, pushTicket: null, frozen: null }
		};
	}

	if (
		removedSelected.length > 0 ||
		removedWishlistSections.length > 0 ||
		removedWishlistGroups.length > 0 ||
		removedStagingGroups.length > 0 ||
		removedStagingSections.length > 0
	) {
		didRepair = true;
		next = {
			...next,
			selection: {
				...next.selection,
				selected: nextSelected as any,
				wishlistSections: nextWishlistSections as any,
				wishlistGroups: nextWishlistGroups as any
			},
			solver: {
				...next.solver,
				staging: nextStagingWithoutMissingGroups as any
			}
		};
	}

	if (hasIssues) {
		const issueKey = buildIssueKey({
			datasetSigBefore,
			datasetSigAfter,
			changedGroups,
			removedWishlistGroups,
			removedStagingGroups,
			removedSelectedCount: removedSelected.length,
			removedWishlistSectionCount: removedWishlistSections.length,
			removedStagingSectionCount: removedStagingSections.length
		});

		const alreadySameIssue = next.dataset.fatalResolve?.issueKey === issueKey;
		if (!alreadySameIssue) {
			const nextFatalResolveCount = next.dataset.fatalResolveCount + 1;
			const didDowngradeGranularity = nextFatalResolveCount > 2;
			didRepair = true;

			next = appendHistory(
				{
					...next,
					dataset: {
						...next.dataset,
						fatalResolveCount: nextFatalResolveCount,
						fatalResolve: {
							issueKey,
							at: nowEpochMs(),
							datasetSigBefore,
							datasetSigAfter,
							changedGroups,
							removedWishlistGroups,
							removedStagingGroups
						}
					},
					settings: didDowngradeGranularity ? downgradeGranularity(next.settings) : next.settings
				},
				{
					id: `ds:fatal:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'settings',
					label: didDowngradeGranularity ? '数据集变化：降级到班次模式' : '数据集变化：需要确认',
					details: {
						changedGroups,
						removedSelected,
						removedWishlistSections,
						removedWishlistGroups,
						removedStagingGroups,
						removedStagingSections,
						fatalResolveCount: nextFatalResolveCount
					}
				}
			);
		} else if (next.dataset.fatalResolveCount > 2) {
			const shouldDowngrade =
				next.settings.granularity.allCourses !== 'sectionOnly' ||
				next.settings.granularity.candidates !== 'sectionOnly' ||
				next.settings.granularity.solver !== 'sectionOnly';
			if (shouldDowngrade) {
				didRepair = true;
				next = {
					...next,
					settings: downgradeGranularity(next.settings)
				};
			}
		}
	}

	return { ok: true, state: next, didRepair };
}
