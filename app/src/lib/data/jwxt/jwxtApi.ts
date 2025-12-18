import {
	frontendJwxtDrop,
	frontendJwxtEnroll,
	frontendJwxtLogin,
	frontendJwxtLogout,
	frontendJwxtPing,
	frontendJwxtPush,
	frontendJwxtRounds,
	frontendJwxtSearch,
	frontendJwxtSelectRound,
	frontendJwxtStatus,
	frontendJwxtSyncSelected
} from './jwxtFrontendClient';

export type JwxtAccount = {
	userId: string;
	displayName?: string;
};

export type JwxtStatus = {
	supported: boolean;
	loggedIn: boolean;
	account?: JwxtAccount;
	message?: string;
};

export type JwxtApiOk<T> = { ok: true } & T;
export type JwxtApiError = { ok: false; error: string; supported?: boolean };
export type JwxtApiResponse<T> = JwxtApiOk<T> | JwxtApiError;

export async function jwxtGetStatus(): Promise<JwxtApiResponse<JwxtStatus>> {
	const status = await frontendJwxtStatus();
	return { ok: true, ...status };
}

export async function jwxtPing(): Promise<
	JwxtApiResponse<{
		ssoEntryStatus: number;
		finalUrl?: string;
		message?: string;
	}>
> {
	try {
		const res = await frontendJwxtPing();
		return res;
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtLogin(payload: {
	userId: string;
	password: string;
}): Promise<JwxtApiResponse<JwxtStatus>> {
	try {
		const status = await frontendJwxtLogin(payload);
		return status.loggedIn ? { ok: true, ...status } : { ok: false, error: status.message ?? 'Login failed', supported: status.supported };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

export async function jwxtImportCookie(payload: { userId?: string; cookie: string }): Promise<JwxtApiResponse<JwxtStatus>> {
	return { ok: false, supported: false, error: 'IMPORT_COOKIE_UNSUPPORTED_FRONTEND' };
}

export async function jwxtExportCookie(): Promise<JwxtApiResponse<{ cookie: string }>> {
	return { ok: false, supported: false, error: 'EXPORT_COOKIE_UNSUPPORTED_FRONTEND' };
}

export async function jwxtLogout(): Promise<JwxtApiResponse<JwxtStatus>> {
	return { ok: true, ...frontendJwxtLogout() };
}

export type JwxtRoundInfo = {
	xkkzId: string;
	xklc?: string;
	xklcmc?: string;
	kklxdm: string;
	kklxLabel: string;
	active: boolean;
};

export type JwxtRoundsPayload = {
	term: {
		xkxnm?: string;
		xkxqm?: string;
		xkxnmc?: string;
		xkxqmc?: string;
	};
	selectedXkkzId?: string | null;
	activeXkkzId?: string | null;
	rounds: JwxtRoundInfo[];
};

export async function jwxtGetRounds(): Promise<JwxtApiResponse<JwxtRoundsPayload>> {
	try {
		const data = await frontendJwxtRounds();
		return { ok: true, ...data };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtSelectRound(payload: { xkkzId: string }): Promise<JwxtApiResponse<{ selectedXkkzId: string }>> {
	try {
		const res = await frontendJwxtSelectRound(payload.xkkzId);
		return { ok: true, ...res };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export type JwxtSelectedPair = { kchId: string; jxbId: string };

export async function jwxtSyncFromRemote(): Promise<JwxtApiResponse<{ selected: JwxtSelectedPair[] }>> {
	try {
		const res = await frontendJwxtSyncSelected();
		return res.ok ? res : { ok: false, error: 'Sync failed' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export type JwxtPushSummary = {
	enrollPlanned: number;
	dropPlanned: number;
	enrollDone: number;
	dropDone: number;
};

export type JwxtPushResult = {
	op: 'enroll' | 'drop';
	kchId: string;
	jxbId: string;
	ok: boolean;
	message?: string;
};

export type JwxtPushPlanItem = {
	kchId: string;
	jxbId: string;
	localCourseId?: string;
	localTitle?: string;
	localTeacher?: string;
	localTime?: string;
};

export type JwxtPushPlan = {
	toEnroll: JwxtPushPlanItem[];
	toDrop: JwxtPushPlanItem[];
};

export async function jwxtPushToRemote(payload: { selectionSnapshotBase64: string; dryRun?: boolean }): Promise<
	JwxtApiResponse<{
		plan: JwxtPushPlan;
		summary: JwxtPushSummary;
		results: JwxtPushResult[];
	}>
> {
	try {
		const res = await frontendJwxtPush(payload.selectionSnapshotBase64, Boolean(payload.dryRun));
		return res.ok ? res : { ok: false, error: res.error ?? 'Push failed' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtSearch(payload: {
	query: string;
}): Promise<
	JwxtApiResponse<{
		results: Array<{
			kchId: string;
			courseName: string;
			jxbId: string;
			teacher: string;
			time: string;
			credit: string;
		}>;
	}>
> {
	try {
		const res = await frontendJwxtSearch(payload.query);
		return res.ok ? res : { ok: false, error: res.error ?? 'Search failed' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtEnroll(payload: { kchId: string; jxbId: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	try {
		const res = await frontendJwxtEnroll(payload.kchId, payload.jxbId);
		return res.ok ? res : { ok: false, error: res.error ?? 'Enroll failed' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtDrop(payload: { kchId: string; jxbId: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	try {
		const res = await frontendJwxtDrop(payload.kchId, payload.jxbId);
		return res.ok ? res : { ok: false, error: res.error ?? 'Drop failed' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtCrawlSnapshot(payload: { termId?: string; limitCourses?: number } = {}): Promise<
	JwxtApiResponse<{
		termId: string;
		snapshot: unknown;
	}>
> {
	return { ok: false, supported: false, error: 'CRAWL_UNSUPPORTED_FRONTEND' };
}
