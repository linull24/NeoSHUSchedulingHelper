import type { JwxtEnrollmentBreakdown } from './enrollmentBreakdown';

/**
 * JWXT “已选人数明细”批次类别（按 UI 习惯命名）
 *
 * NOTE:
 * - 这些是“已选人数拆分”的类别，不是 “选课轮次”(xklc)。
 * - `★` 标记（enrollmentBreakdown.userBatchLabel）是用户态：表示当前用户所在批次；
 *   只有 userscript 登录后才可用，云端/SSG 快照不得包含。
 */
export type EnrollmentBatchLabel =
	| '预置已选人数'
	| '培养方案已选人数'
	| '高年级已选人数'
	| '其他已选人数';

/**
 * 固定的 UI 顺序（用于解释 “★ 上面/下面” 的累计含义）。
 *
 * Example (observed):
 * 类型 数值 所属类型
 * 预置已选人数 0
 * 培养方案已选人数 40 ★
 * 高年级已选人数 0
 * 其他已选人数 0
 * 总计 40
 */
export const ENROLLMENT_BATCH_ORDER: EnrollmentBatchLabel[] = [
	'预置已选人数',
	'培养方案已选人数',
	'高年级已选人数',
	'其他已选人数'
];

export function isEnrollmentBatchLabel(label: string): label is EnrollmentBatchLabel {
	return (ENROLLMENT_BATCH_ORDER as string[]).includes(label);
}

export type UserBatchState =
	| { kind: 'available'; label: EnrollmentBatchLabel }
	| { kind: 'unavailable'; reason: 'NO_USERSCRIPT' | 'NO_MARKER' | 'PARSE_FAILED' };

/**
 * Derive the current user's batch from enrollment breakdown.
 * Only valid in userscript runtime; for cloud snapshots this must be unavailable.
 */
export function deriveUserBatchState(breakdown: JwxtEnrollmentBreakdown | null | undefined): UserBatchState {
	if (!breakdown) return { kind: 'unavailable', reason: 'PARSE_FAILED' };
	const label = String((breakdown as any).userBatchLabel ?? '').trim();
	if (!label) return { kind: 'unavailable', reason: 'NO_MARKER' };
	if (!isEnrollmentBatchLabel(label)) return { kind: 'unavailable', reason: 'PARSE_FAILED' };
	return { kind: 'available', label };
}

/**
 * Policy: user chooses the minimum acceptable batch label (底线).
 *
 * Interpretation:
 * - The user's batch label (★) indicates where the user belongs (e.g. prerequisites may place them in “其他”).
 * - `minAcceptable` is a threshold: user only wants to attempt courses where their ★ batch is at least this strict.
 *   (Example: if user can only select in “其他”, set minAcceptable="其他已选人数".)
 */
export type UserMinAcceptableBatchPolicy = {
	minAcceptable: EnrollmentBatchLabel;
};

function batchRank(label: EnrollmentBatchLabel): number {
	return ENROLLMENT_BATCH_ORDER.indexOf(label);
}

export function isUserBatchAllowedByMinPolicy(input: {
	userBatch: UserBatchState;
	policy: UserMinAcceptableBatchPolicy;
}): { ok: boolean; reason?: 'UNAVAILABLE' | 'BELOW_MIN_ACCEPTABLE' } {
	if (input.userBatch.kind !== 'available') return { ok: false, reason: 'UNAVAILABLE' };
	return batchRank(input.userBatch.label) >= batchRank(input.policy.minAcceptable)
		? { ok: true }
		: { ok: false, reason: 'BELOW_MIN_ACCEPTABLE' };
}

/**
 * Derive a conservative "rank interval" for the current user based on breakdown counts.
 *
 * Rationale (from ref implementations):
 * - Let `end` be the cumulative sum up to and including the ★ row.
 * - Let `start` be the cumulative sum strictly above the ★ row.
 * - Then the user's (1-based) "rank" is in [start+1, end].
 *
 * If `end` is already >= capacity, then the user cannot get in under this cohort/batch.
 *
 * NOTE: This is a heuristic for UX / polling decisions. Actual JWXT eligibility still depends on server-side checks.
 */
export function computeUserRankInterval(input: {
	breakdown: JwxtEnrollmentBreakdown;
	capacity: number | null;
}): { start: number; end: number; capacity: number | null; userBatchLabel?: EnrollmentBatchLabel } | null {
	const { breakdown, capacity } = input;
	const userBatch = deriveUserBatchState(breakdown);
	if (userBatch.kind !== 'available') return null;

	const byLabel = new Map<string, number>();
	for (const item of breakdown.items) {
		if (!item.label) continue;
		if (typeof item.value !== 'number' || !Number.isFinite(item.value)) continue;
		byLabel.set(item.label, item.value);
	}

	let start = 0;
	let end = 0;
	for (const label of ENROLLMENT_BATCH_ORDER) {
		const v = byLabel.get(label) ?? 0;
		end += v;
		if (label === userBatch.label) break;
		start += v;
	}

	return { start, end, capacity: capacity != null && Number.isFinite(capacity) ? capacity : null, userBatchLabel: userBatch.label };
}

export function isUserImpossibleGivenCapacity(input: {
	breakdown: JwxtEnrollmentBreakdown;
	capacity: number | null;
}): { impossible: boolean; reason?: 'CAPACITY_MISSING' | 'RANK_OVER_CAPACITY' } {
	const interval = computeUserRankInterval(input);
	if (!interval) return { impossible: false };
	if (interval.capacity == null) return { impossible: false, reason: 'CAPACITY_MISSING' };
	return interval.end >= interval.capacity ? { impossible: true, reason: 'RANK_OVER_CAPACITY' } : { impossible: false };
}

