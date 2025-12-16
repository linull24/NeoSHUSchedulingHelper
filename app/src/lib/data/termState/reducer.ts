import { courseCatalogMap } from '../catalog/courseCatalog';
import type { ManualUpdate } from '../manualUpdates';
import { deriveGroupKey } from './groupKey';
import { encodeBase64 } from '../utils/base64';
import { assertNever, type ActionEntryV1, type GroupKey, type JwxtPair, type TermAction, type TermEffect, type TermState } from './types';

export interface ReduceResult {
	state: TermState;
	effects: TermEffect[];
}

function nowEpochMs() {
	return Date.now() as any;
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

function addSelected(state: TermState, entryId: string) {
	const next = new Set(state.selection.selected);
	next.add(entryId as any);
	return Array.from(next) as any;
}

function removeSelected(state: TermState, entryId: string) {
	return state.selection.selected.filter((id) => id !== entryId) as any;
}

function addWishlistSection(state: TermState, entryId: string) {
	const next = new Set(state.selection.wishlistSections);
	next.add(entryId as any);
	return Array.from(next) as any;
}

function removeWishlistSection(state: TermState, entryId: string) {
	return state.selection.wishlistSections.filter((id) => id !== entryId) as any;
}

function addWishlistGroup(state: TermState, groupKey: GroupKey) {
	const next = new Set(state.selection.wishlistGroups);
	next.add(groupKey as any);
	return Array.from(next) as any;
}

function removeWishlistGroup(state: TermState, groupKey: GroupKey) {
	return state.selection.wishlistGroups.filter((key) => key !== groupKey) as any;
}

function ensureWishlistAnchorsForEntry(state: TermState, entryId: string) {
	const entry = courseCatalogMap.get(entryId);
	if (!entry) return state;
	const groupKey = deriveGroupKey(entry);
	return {
		...state,
		selection: {
			...state.selection,
			wishlistSections: addWishlistSection(state, entryId),
			wishlistGroups: addWishlistGroup(state, groupKey)
		}
	};
}

function resolveEntryIdFromUpdate(update: ManualUpdate): string | null {
	if (update.kind === 'upsert-section') {
		const sectionId = update.section?.sectionId;
		if (!sectionId) return null;
		if (update.courseHash) {
			const entryId = `${update.courseHash}:${sectionId}`;
			if (courseCatalogMap.has(entryId)) return entryId;
		}
		if (update.courseCode) {
			for (const entry of courseCatalogMap.values()) {
				if (entry.courseCode === update.courseCode && entry.sectionId === sectionId) return entry.id;
			}
		}
		for (const entry of courseCatalogMap.values()) {
			if (entry.sectionId === sectionId) return entry.id;
		}
		return null;
	}
	if (update.kind === 'remove-section') {
		const sectionId = update.sectionId;
		if (!sectionId) return null;
		if (update.courseHash) {
			const entryId = `${update.courseHash}:${sectionId}`;
			if (courseCatalogMap.has(entryId)) return entryId;
		}
		if (update.courseCode) {
			for (const entry of courseCatalogMap.values()) {
				if (entry.courseCode === update.courseCode && entry.sectionId === sectionId) return entry.id;
			}
		}
		for (const entry of courseCatalogMap.values()) {
			if (entry.sectionId === sectionId) return entry.id;
		}
		return null;
	}
	return null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function mapEntryIdToJwxtPair(entryId: string): JwxtPair | null {
	const entry = courseCatalogMap.get(entryId);
	if (!entry) return null;
	return { kchId: entry.courseCode, jxbId: entry.sectionId };
}

function computeDiff(remote: JwxtPair[], desired: JwxtPair[]) {
	const key = (pair: JwxtPair) => `${pair.kchId}::${pair.jxbId}`;
	const remoteSet = new Set(remote.map(key));
	const desiredSet = new Set(desired.map(key));
	const toEnroll = desired.filter((pair) => !remoteSet.has(key(pair)));
	const toDrop = remote.filter((pair) => !desiredSet.has(key(pair)));
	return { toEnroll, toDrop };
}

export async function reduceTermState(state: TermState, action: TermAction): Promise<ReduceResult> {
	switch (action.type) {
		case 'SEL_PROMOTE_SECTION': {
			const entry = courseCatalogMap.get(action.entryId);
			if (!entry) throw new Error(`UNKNOWN_ENTRY_ID:${action.entryId}`);
			const groupKey = deriveGroupKey(entry);
			const existing = state.selection.selected.find((id) => {
				const existingEntry = courseCatalogMap.get(id);
				return existingEntry ? deriveGroupKey(existingEntry) === groupKey : false;
			});
			if (existing && existing !== action.entryId) {
				throw new Error(`DUPLICATE_GROUP_SELECTED:${groupKey}`);
			}

			if (action.to === 'wishlist') {
				const next: TermState = appendHistory(
					{
						...state,
						selection: {
							...state.selection,
							wishlistSections: addWishlistSection(state, action.entryId),
							wishlistGroups: addWishlistGroup(state, groupKey)
						}
					},
					{
						id: `sel:wishlist:${action.entryId}`,
						at: nowEpochMs(),
						type: 'selection',
						label: '收藏班次',
						details: { entryId: action.entryId }
					}
				);
				return { state: next, effects: [] };
			}

			const next: TermState = appendHistory(
				{
					...state,
					selection: {
						...state.selection,
						selected: addSelected(state, action.entryId),
						wishlistSections: removeWishlistSection(state, action.entryId)
					}
				},
				{
					id: `sel:selected:${action.entryId}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '选上班次',
					details: { entryId: action.entryId }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SEL_DEMOTE_SECTION': {
			if (!courseCatalogMap.has(action.entryId)) throw new Error(`UNKNOWN_ENTRY_ID:${action.entryId}`);

			if (action.to === 'all') {
				const next = appendHistory(
					{
						...state,
						selection: {
							...state.selection,
							selected: removeSelected(state, action.entryId),
							wishlistSections: removeWishlistSection(state, action.entryId)
						}
					},
					{
						id: `sel:all:${action.entryId}`,
						at: nowEpochMs(),
						type: 'selection',
						label: '移除班次',
						details: { entryId: action.entryId }
					}
				);
				return { state: next, effects: [] };
			}

			const base: TermState = appendHistory(
				{
					...state,
					selection: {
						...state.selection,
						selected: removeSelected(state, action.entryId),
						wishlistSections: addWishlistSection(state, action.entryId)
					}
				},
				{
					id: `sel:demote:${action.entryId}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '退选到愿望单',
					details: { entryId: action.entryId }
				}
			);
			return { state: ensureWishlistAnchorsForEntry(base, action.entryId), effects: [] };
		}
		case 'SEL_PROMOTE_GROUP': {
			if (action.to === 'wishlist') {
				const next = appendHistory(
					{
						...state,
						selection: {
							...state.selection,
							wishlistGroups: addWishlistGroup(state, action.groupKey)
						}
					},
					{
						id: `sel:wishlist-group:${action.groupKey}`,
						at: nowEpochMs(),
						type: 'selection',
						label: '收藏课程组',
						details: { groupKey: action.groupKey }
					}
				);
				return { state: next, effects: [] };
			}
			// Group -> Selected requires an explicit section pick (D-SEL-1). Enforced by dispatch layer.
			throw new Error('DIALOG_REQUIRED:D-SEL-1');
		}
		case 'SEL_DEMOTE_GROUP': {
			const next = appendHistory(
				{
					...state,
					selection: {
						...state.selection,
						wishlistGroups: removeWishlistGroup(state, action.groupKey)
					}
				},
				{
					id: `sel:remove-group:${action.groupKey}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '移除课程组',
					details: { groupKey: action.groupKey }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SEL_CLEAR_WISHLIST': {
			const next = appendHistory(
				{
					...state,
					selection: { ...state.selection, wishlistSections: [], wishlistGroups: [] }
				},
				{
					id: `sel:clear-wishlist:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '清空愿望单',
					details: { count: state.selection.wishlistSections.length + state.selection.wishlistGroups.length }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SEL_CLEAR_WISHLIST_WITH_PRUNE': {
			const removeSet = new Set(action.removeLockIds);
			const nextLocks = state.solver.constraints.locks.filter((lock) => !removeSet.has(lock.id));
			const next = appendHistory(
				{
					...state,
					selection: { ...state.selection, wishlistSections: [], wishlistGroups: [] },
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							locks: nextLocks
						}
					}
				},
				{
					id: `sel:clear-wishlist-prune:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '清空愿望单并删除相关约束',
					details: { removedLocks: action.removeLockIds, count: action.removeLockIds.length }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SEL_RESELECT_WITHIN_GROUP': {
			if (!courseCatalogMap.has(action.nextEntryId)) throw new Error(`UNKNOWN_ENTRY_ID:${action.nextEntryId}`);
			const nextEntry = courseCatalogMap.get(action.nextEntryId);
			if (!nextEntry) throw new Error(`UNKNOWN_ENTRY_ID:${action.nextEntryId}`);
			const nextGroup = deriveGroupKey(nextEntry);
			if (nextGroup !== action.groupKey) throw new Error('INVALID_ACTION:reselect-group-mismatch');

			const currentSelected = state.selection.selected.find((id) => {
				const entry = courseCatalogMap.get(id);
				return entry ? deriveGroupKey(entry) === action.groupKey : false;
			});
			if (!currentSelected) throw new Error('INVALID_ACTION:no-selected-in-group');

			const nextSelected = state.selection.selected
				.filter((id) => id !== currentSelected)
				.concat(action.nextEntryId) as any;

			const next = appendHistory(
				{
					...state,
					selection: {
						...state.selection,
						selected: nextSelected,
						wishlistSections: addWishlistSection(state, currentSelected)
					}
				},
				{
					id: `sel:reselect:${action.groupKey}`,
					at: nowEpochMs(),
					type: 'selection',
					label: '重选班次',
					details: { groupKey: action.groupKey, from: currentSelected, to: action.nextEntryId }
				}
			);
			return { state: ensureWishlistAnchorsForEntry(next, currentSelected), effects: [] };
		}
		case 'DATASET_REFRESH': {
			const next = appendHistory(state, {
				id: `ds:refresh:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'settings',
				label: '在线更新数据集并重试'
			});
			return { state: next, effects: [{ type: 'EFF_DATASET_REFRESH' }] };
		}
		case 'DATASET_RESOLVE_ACK': {
			if (!state.dataset.fatalResolve) return { state, effects: [] };
			const next = appendHistory(
				{
					...state,
					dataset: {
						...state.dataset,
						fatalResolve: null
					}
				},
				{
					id: `ds:ack:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'settings',
					label: '数据集变化：继续使用'
				}
			);
			return { state: next, effects: [] };
		}
		case 'DATASET_RESOLVE_SWITCH_SECTION_ONLY': {
			const next = appendHistory(
				{
					...state,
					dataset: {
						...state.dataset,
						fatalResolve: null
					},
					selection: {
						...state.selection,
						wishlistGroups: []
					},
					solver: {
						...state.solver,
						staging: state.solver.staging.filter((item) => item.kind !== 'group')
					},
					settings: {
						...state.settings,
						granularity: {
							...state.settings.granularity,
							allCourses: 'sectionOnly',
							candidates: 'sectionOnly',
							solver: 'sectionOnly'
						}
					}
				},
				{
					id: `ds:section-only:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'settings',
					label: '数据集变化：切换为班次模式'
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_PULL_REMOTE': {
			const next = appendHistory(state, {
				id: `jwxt:pull:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: 'Pull 远端已选'
			});
			return { state: next, effects: [{ type: 'EFF_JWXT_FETCH_PAIRS' }] };
		}
		case 'JWXT_PULL_OK': {
			if (action.unresolvedRefs?.length) {
				const frozen = {
					reason: 'PULL_UNRESOLVED_REMOTE' as const,
					failedList: action.unresolvedRefs.map((ref) => ({ op: 'resolve' as const, ref, error: 'unresolved' })),
					backup: {
						wishlistGroups: state.selection.wishlistGroups,
						wishlistSections: state.selection.wishlistSections,
						solverStaging: state.solver.staging
					},
					frozenWishlist: { wishlistGroups: [], wishlistSections: [] }
				};
				const next: TermState = appendHistory(
					{
						...state,
						jwxt: {
							...state.jwxt,
							syncState: 'FROZEN',
							remoteSnapshot: { pairs: action.pairs, digest: action.digest, fetchedAt: action.fetchedAt },
							frozen
						}
					},
					{
						id: `jwxt:frozen:pull:${state.history.entries.length}`,
						at: nowEpochMs(),
						type: 'jwxt',
						label: '远端课程无法映射：冻结'
					}
				);
				return { state: next, effects: [] };
			}
			const next: TermState = appendHistory(
				{
					...state,
					jwxt: {
						...state.jwxt,
						syncState: 'LOCKED',
						remoteSnapshot: { pairs: action.pairs, digest: action.digest, fetchedAt: action.fetchedAt },
						baseline: { digest: action.digest, fetchedAt: action.fetchedAt, datasetSig: state.dataset.sig },
						pushTicket: null
					}
				},
				{
					id: `jwxt:pull-ok:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: 'Pull 成功'
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_PULL_ERR': {
			const next = appendHistory(state, {
				id: `jwxt:pull-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: 'Pull 失败',
				details: { error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'JWXT_PREVIEW_PUSH': {
			if (!state.jwxt.remoteSnapshot) throw new Error('NEEDS_PULL');
			const selectedPairs = state.selection.selected
				.map((id) => mapEntryIdToJwxtPair(id))
				.filter(Boolean) as JwxtPair[];
			const diff = computeDiff(state.jwxt.remoteSnapshot.pairs, selectedPairs);
			const next = appendHistory(
				{
					...state,
					jwxt: {
						...state.jwxt,
						pushTicket: {
							createdAt: nowEpochMs(),
							baseDigest: state.jwxt.remoteSnapshot.digest,
							selectedSig: state.selection.selectedSig,
							datasetSig: state.dataset.sig,
							ttlMs: action.ttlMs,
							diff
						}
					}
				},
				{
					id: `jwxt:preview:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '预览差异',
					details: { ttlMs: action.ttlMs, toEnroll: diff.toEnroll.length, toDrop: diff.toDrop.length }
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_CONFIRM_PUSH': {
			if (!state.jwxt.pushTicket) throw new Error('INVALID_ACTION:missing-push-ticket');
			const payload = await encodeSelectionPayloadBase64(state);
			const next = appendHistory(state, {
				id: `jwxt:confirm:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '确认推送'
			});
			return {
				state: next,
				effects: [
					{
						type: 'EFF_JWXT_PUSH_DIFF',
						payloadBase64: payload,
						dryRun: false,
						ttlMs: state.jwxt.pushTicket.ttlMs,
						baseDigest: state.jwxt.pushTicket.baseDigest
					}
				]
			};
		}
		case 'JWXT_REMOTE_CHANGED': {
			const selectedPairs = state.selection.selected
				.map((id) => mapEntryIdToJwxtPair(id))
				.filter(Boolean) as JwxtPair[];
			const diff = computeDiff(action.pairs, selectedPairs);
			const next: TermState = appendHistory(
				{
					...state,
					jwxt: {
						...state.jwxt,
						syncState: 'REMOTE_DIRTY',
						remoteSnapshot: { pairs: action.pairs, digest: action.digest, fetchedAt: action.fetchedAt },
						pushTicket: state.jwxt.pushTicket
							? {
									...state.jwxt.pushTicket,
									baseDigest: action.digest,
									diff
							  }
							: null
					}
				},
				{
					id: `jwxt:remote-changed:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '教务已变化：已重新计算差异',
					details: { toEnroll: diff.toEnroll.length, toDrop: diff.toDrop.length }
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_PUSH_OK': {
			const failed = action.results.filter((r) => !r.ok);
			if (failed.length) {
				const frozen = {
					reason: 'PUSH_PARTIAL_FAILURE' as const,
					failedList: failed.map((item) => ({
						op: item.op,
						ref: item.ref,
						error: item.error ?? 'unknown'
					})),
					backup: {
						wishlistGroups: state.selection.wishlistGroups,
						wishlistSections: state.selection.wishlistSections,
						solverStaging: state.solver.staging
					},
					frozenWishlist: { wishlistGroups: [], wishlistSections: [] }
				};
				const next = appendHistory(
					{
						...state,
						jwxt: { ...state.jwxt, syncState: 'FROZEN', frozen, pushTicket: null }
					},
					{
						id: `jwxt:frozen:push:${state.history.entries.length}`,
						at: nowEpochMs(),
						type: 'jwxt',
						label: '推送部分失败：冻结'
					}
				);
				return { state: next, effects: [] };
			}
			const next = appendHistory(
				{
					...state,
					jwxt: { ...state.jwxt, baseline: null, pushTicket: null, syncState: 'NEEDS_PULL' }
				},
				{
					id: `jwxt:push-ok:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '推送成功'
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_PUSH_ERR': {
			const next = appendHistory(state, {
				id: `jwxt:push-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '推送失败',
				details: { error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'JWXT_DROP_NOW': {
			const next = appendHistory(state, {
				id: `jwxt:drop:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '立即退课',
				details: { pair: action.pair }
			});
			return { state: next, effects: [{ type: 'EFF_JWXT_DROP', pair: action.pair }] };
		}
		case 'JWXT_DROP_OK': {
			const next = appendHistory(
				{
					...state,
					jwxt: { ...state.jwxt, baseline: null, pushTicket: null, syncState: 'NEEDS_PULL' }
				},
				{
					id: `jwxt:drop-ok:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '退课成功',
					details: { pair: action.pair }
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_DROP_ERR': {
			const next = appendHistory(state, {
				id: `jwxt:drop-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '退课失败',
				details: { pair: action.pair, error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'JWXT_ENROLL_NOW': {
			const next = appendHistory(state, {
				id: `jwxt:enroll:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '立即选课',
				details: { pair: action.pair }
			});
			return { state: next, effects: [{ type: 'EFF_JWXT_ENROLL', pair: action.pair }] };
		}
		case 'JWXT_ENROLL_OK': {
			const next = appendHistory(
				{
					...state,
					jwxt: { ...state.jwxt, baseline: null, pushTicket: null, syncState: 'NEEDS_PULL' }
				},
				{
					id: `jwxt:enroll-ok:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '选课成功',
					details: { pair: action.pair }
				}
			);
			return { state: next, effects: [] };
		}
		case 'JWXT_ENROLL_ERR': {
			const next = appendHistory(state, {
				id: `jwxt:enroll-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'jwxt',
				label: '选课失败',
				details: { pair: action.pair, error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'JWXT_FROZEN_ACK_RESUME': {
			const next = appendHistory(
				{
					...state,
					jwxt: { ...state.jwxt, syncState: 'NEEDS_PULL', frozen: null, baseline: null, pushTicket: null }
				},
				{
					id: `jwxt:resume:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'jwxt',
					label: '解冻'
				}
			);
			return { state: next, effects: [] };
		}
		case 'HIST_TOGGLE_TO_INDEX': {
			if (action.index < 0 || action.index > state.history.cursor) {
				throw new Error('INVALID_ACTION:history-index-out-of-range');
			}
			return {
				state: {
					...state,
					history: {
						...state.history,
						cursor: action.index
					}
				},
				effects: []
			};
		}
		case 'SETTINGS_UPDATE': {
			const next = appendHistory(
				{
					...state,
					settings: {
						...state.settings,
						...action.patch,
						granularity: {
							...state.settings.granularity,
							...(action.patch.granularity ?? {})
						},
						jwxt: {
							...state.settings.jwxt,
							...(action.patch.jwxt ?? {})
						}
					}
				},
				{
					id: `settings:update:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'settings',
					label: '更新设置'
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_ADD_LOCK': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							locks: state.solver.constraints.locks.filter((item) => item.id !== action.lock.id).concat(action.lock)
						}
					}
				},
				{
					id: `solver:add-lock:${action.lock.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '新增硬约束',
					details: { id: action.lock.id, type: action.lock.type, priority: action.lock.priority }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_REMOVE_LOCK': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							locks: state.solver.constraints.locks.filter((item) => item.id !== action.id)
						}
					}
				},
				{
					id: `solver:remove-lock:${action.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '移除硬约束',
					details: { id: action.id }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_UPDATE_LOCK': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							locks: state.solver.constraints.locks.map((item) =>
								item.id === action.id ? { ...item, ...action.patch } : item
							)
						}
					}
				},
				{
					id: `solver:update-lock:${action.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '更新硬约束',
					details: { id: action.id }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_ADD_SOFT': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							soft: state.solver.constraints.soft
								.filter((item) => item.id !== action.constraint.id)
								.concat(action.constraint)
						}
					}
				},
				{
					id: `solver:add-soft:${action.constraint.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '新增软约束',
					details: { id: action.constraint.id, type: action.constraint.type, weight: action.constraint.weight }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_REMOVE_SOFT': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							soft: state.solver.constraints.soft.filter((item) => item.id !== action.id)
						}
					}
				},
				{
					id: `solver:remove-soft:${action.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '移除软约束',
					details: { id: action.id }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_UPDATE_SOFT': {
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						constraints: {
							...state.solver.constraints,
							soft: state.solver.constraints.soft.map((item) =>
								item.id === action.id ? { ...item, ...action.patch } : item
							)
						}
					}
				},
				{
					id: `solver:update-soft:${action.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '更新软约束',
					details: { id: action.id }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_RUN': {
			const next = appendHistory(state, {
				id: `solver:run:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'solver',
				label: '运行求解器',
				details: { runType: action.runType ?? 'manual', note: action.note }
			});
			return {
				state: next,
				effects: [{ type: 'EFF_SOLVER_RUN', runType: action.runType ?? 'manual', note: action.note }]
			};
		}
		case 'SOLVER_RUN_OK': {
			const inputsSig = `${action.record.desiredSignature}:${action.record.selectionSignature}`;
			const next = appendHistory(
				{
					...state,
					solver: {
						...state.solver,
						lastRun: { runId: action.record.id, runType: action.record.runType, at: nowEpochMs(), inputsSig },
						results: state.solver.results.concat(action.record)
					}
				},
				{
					id: `solver:run-ok:${action.record.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '求解完成',
					details: { status: action.record.status, plan: action.record.plan.length }
				}
			);
			return { state: next, effects: [] };
		}
		case 'SOLVER_RUN_ERR': {
			const next = appendHistory(state, {
				id: `solver:run-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'solver',
				label: '求解失败',
				details: { error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'SOLVER_APPLY_RESULT': {
			const record = state.solver.results.find((item) => item.id === action.resultId);
			if (!record) throw new Error('INVALID_ACTION:solver-apply-missing-result');
			if (record.status !== 'sat') throw new Error('INVALID_ACTION:solver-apply-unsat');
			if (!record.plan.length) throw new Error('INVALID_ACTION:solver-apply-empty-plan');

			const before = state.selection;
			const plannedAdds = record.plan
				.filter((item) => item.kind === 'upsert-section')
				.map((item) => resolveEntryIdFromUpdate(item))
				.filter(Boolean) as string[];
			const plannedRemovals = record.plan
				.filter((item) => item.kind === 'remove-section')
				.map((item) => resolveEntryIdFromUpdate(item))
				.filter(Boolean) as string[];

			const selectedBefore = new Set(before.selected as unknown as string[]);
			const groupSelected = new Map<string, string>();
			for (const entryId of before.selected as unknown as string[]) {
				const entry = courseCatalogMap.get(entryId);
				if (!entry) continue;
				groupSelected.set(deriveGroupKey(entry), entryId);
			}

			const conflictRemovals: string[] = [];
			for (const entryId of plannedAdds) {
				const entry = courseCatalogMap.get(entryId);
				if (!entry) throw new Error(`UNKNOWN_ENTRY_ID:${entryId}`);
				const groupKey = deriveGroupKey(entry);
				const existing = groupSelected.get(groupKey);
				if (existing && existing !== entryId) {
					conflictRemovals.push(existing);
				}
				groupSelected.set(groupKey, entryId);
			}

			const removeSet = new Set<string>();
			for (const id of conflictRemovals) removeSet.add(id);
			if (action.mode === 'replace-all') {
				for (const id of plannedRemovals) removeSet.add(id);
			}

			let nextSelection: TermState = {
				...state,
				selection: {
					...state.selection,
					selected: (state.selection.selected as unknown as string[]).filter((id) => !removeSet.has(id)) as any,
					wishlistSections: state.selection.wishlistSections,
					wishlistGroups: state.selection.wishlistGroups
				}
			};

			const removed: string[] = [];
			for (const entryId of removeSet) {
				if (!selectedBefore.has(entryId)) continue;
				removed.push(entryId);
				nextSelection = ensureWishlistAnchorsForEntry(nextSelection, entryId);
			}

			const removedFromWishlist = new Set(plannedAdds);
			nextSelection = {
				...nextSelection,
				selection: {
					...nextSelection.selection,
					wishlistSections: (nextSelection.selection.wishlistSections as unknown as string[]).filter(
						(id) => !removedFromWishlist.has(id)
					) as any
				}
			};

			const selectedSetAfterRemovals = new Set(nextSelection.selection.selected as unknown as string[]);
			const added: string[] = [];
			for (const entryId of plannedAdds) {
				if (selectedSetAfterRemovals.has(entryId)) continue;
				added.push(entryId);
				selectedSetAfterRemovals.add(entryId);
			}

			const applied = appendHistory(
				{
					...nextSelection,
					selection: {
						...nextSelection.selection,
						selected: Array.from(selectedSetAfterRemovals) as any
					}
				},
				{
					id: `solver:apply:${record.id}`,
					at: nowEpochMs(),
					type: 'solver',
					label: action.mode === 'replace-all' ? '应用求解结果（替换）' : '应用求解结果（合并）',
					details: {
						kind: 'solver:apply',
						resultId: record.id,
						mode: action.mode,
						planLength: record.plan.length,
						added,
						removed,
						undo: {
							selected: before.selected,
							wishlistSections: before.wishlistSections,
							wishlistGroups: before.wishlistGroups
						}
					}
				}
			);
			return { state: applied, effects: [] };
		}
		case 'SOLVER_UNDO_LAST_APPLY': {
			const slice = state.history.entries.slice(0, state.history.cursor + 1);
			const latestApply = slice
				.slice()
				.reverse()
				.find((entry) => entry.type === 'solver' && entry.details && entry.details['kind'] === 'solver:apply');
			if (!latestApply?.details) throw new Error('INVALID_ACTION:solver-undo-missing-apply');
			const undo = latestApply.details['undo'];
			if (typeof undo !== 'object' || !undo) throw new Error('INVALID_ACTION:solver-undo-invalid-payload');
			const selected = (undo as any).selected;
			const wishlistSections = (undo as any).wishlistSections;
			const wishlistGroups = (undo as any).wishlistGroups;
			if (!isStringArray(selected) || !isStringArray(wishlistSections) || !isStringArray(wishlistGroups)) {
				throw new Error('INVALID_ACTION:solver-undo-invalid-payload');
			}

			const next = appendHistory(
				{
					...state,
					selection: {
						...state.selection,
						selected: selected as any,
						wishlistSections: wishlistSections as any,
						wishlistGroups: wishlistGroups as any
					}
				},
				{
					id: `solver:undo:${state.history.entries.length}`,
					at: nowEpochMs(),
					type: 'solver',
					label: '撤销应用求解结果',
					details: {
						kind: 'solver:undo',
						revertedEntryId: latestApply.id,
						resultId: latestApply.details['resultId']
					}
				}
			);
			return { state: next, effects: [] };
		}
		case 'SYNC_GIST_EXPORT': {
			const payloadBase64 = await encodeTermStateBundleBase64(state);
			const next = appendHistory(state, {
				id: `sync:export:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: '导出到 Gist'
			});
			return {
				state: next,
				effects: [
					{
						type: 'EFF_GIST_PUT',
						token: action.token,
						gistId: action.gistId,
						note: action.note,
						public: action.public,
						payloadBase64
					}
				]
			};
		}
		case 'SYNC_GIST_IMPORT_REPLACE': {
			const next = appendHistory(state, {
				id: `sync:import:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: '从 Gist 导入覆盖',
				details: { gistId: action.gistId }
			});
			return { state: next, effects: [{ type: 'EFF_GIST_GET', token: action.token, gistId: action.gistId }] };
		}
		case 'SYNC_GIST_EXPORT_OK': {
			const next = appendHistory(state, {
				id: `sync:export-ok:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: 'Gist 导出成功',
				details: { gistId: action.gistId, url: action.url }
			});
			return { state: next, effects: [] };
		}
		case 'SYNC_GIST_EXPORT_ERR': {
			const next = appendHistory(state, {
				id: `sync:export-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: 'Gist 导出失败',
				details: { error: action.error }
			});
			return { state: next, effects: [] };
		}
		case 'SYNC_GIST_IMPORT_OK': {
			if (action.state.termId !== state.termId) throw new Error('INVALID_ACTION:sync-import-term-mismatch');
			if (action.state.dataset.sig !== state.dataset.sig) throw new Error('INVALID_ACTION:sync-import-dataset-mismatch');

			const replaced = appendHistory(action.state, {
				id: `sync:import-ok:${action.state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: 'Gist 导入成功',
				details: { gistId: action.gistId, generatedAt: action.generatedAt }
			});
			return { state: replaced, effects: [] };
		}
		case 'SYNC_GIST_IMPORT_ERR': {
			const next = appendHistory(state, {
				id: `sync:import-err:${state.history.entries.length}`,
				at: nowEpochMs(),
				type: 'sync',
				label: 'Gist 导入失败',
				details: { gistId: action.gistId, error: action.error }
			});
			return { state: next, effects: [] };
		}
		default:
			assertNever(action);
	}
}

async function encodeSelectionPayloadBase64(state: TermState) {
	const payload = {
		schema: 'shu-course-selection-v1',
		version: 1,
		generatedAt: Date.now(),
		termId: state.termId,
		semester: state.termId,
		selected: state.selection.selected,
		wishlist: state.selection.wishlistSections
	};
	const json = JSON.stringify(payload);
	return encodeBase64(json);
}

async function encodeTermStateBundleBase64(state: TermState) {
	const payload = {
		version: 1,
		generatedAt: Date.now(),
		termId: state.termId,
		datasetSig: state.dataset.sig,
		termState: state
	};
	const json = JSON.stringify(payload);
	return encodeBase64(json);
}
