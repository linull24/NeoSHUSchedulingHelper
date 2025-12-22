import type { EnrollmentBatchLabel } from './batchPolicy';

/**
 * `terms/batchdata/{termId}.json`
 *
 * This is a cloud/CI generated, USER-AGNOSTIC summary of JWXT “已选人数明细” categories.
 *
 * IMPORTANT:
 * - Do not include ★ markers or `userBatchLabel` here (those are user-specific).
 * - Do not include credentials/cookies/tokens.
 */
export type TermBatchData = {
	version: 1;
	generatedAt: number;
	termId: string;
	termCode?: string;
	jwxtRound?: { xkkzId?: string; xklc?: string; xklcmc?: string };
	source?: 'ci' | 'manual' | 'unknown';
	/**
	 * Categories observed in this term-system deployment.
	 * Normally includes `预置/培养方案/高年级/其他` and may also include other future categories.
	 */
	labels: string[];
	/**
	 * Canonical order (if detected), otherwise just `labels`.
	 */
	order?: EnrollmentBatchLabel[];
	/**
	 * How many sections were sampled when generating stats.
	 */
	sampleCount: number;
	/**
	 * Best-effort stats per label. Values are headcounts (integers) in JWXT HTML.
	 */
	stats: Record<
		string,
		{
			valueCount: number;
			min: number | null;
			max: number | null;
			avg: number | null;
			positiveCount: number;
		}
	>;
};

