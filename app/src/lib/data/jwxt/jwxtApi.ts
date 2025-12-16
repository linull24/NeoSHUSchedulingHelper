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

async function readJson<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!text) return {} as T;
	return JSON.parse(text) as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<JwxtApiResponse<T>> {
	try {
		const response = await fetch(path, {
			...init,
			headers: init?.headers ?? {}
		});
		return await readJson<JwxtApiResponse<T>>(response);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

export async function jwxtGetStatus(): Promise<JwxtApiResponse<JwxtStatus>> {
	return requestJson<JwxtStatus>('/api/jwxt/status', { method: 'GET' });
}

export async function jwxtPing(): Promise<
	JwxtApiResponse<{
		ssoEntryStatus: number;
		finalUrl?: string;
		message?: string;
	}>
> {
	return requestJson('/api/jwxt/ping', { method: 'GET' });
}

export async function jwxtLogin(payload: {
	userId: string;
	password: string;
}): Promise<JwxtApiResponse<JwxtStatus>> {
	return requestJson<JwxtStatus>('/api/jwxt/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export async function jwxtLogout(): Promise<JwxtApiResponse<JwxtStatus>> {
	return requestJson<JwxtStatus>('/api/jwxt/logout', { method: 'POST', headers: { 'content-type': 'application/json' } });
}

export type JwxtSelectedPair = { kchId: string; jxbId: string };

export async function jwxtSyncFromRemote(): Promise<JwxtApiResponse<{ selected: JwxtSelectedPair[] }>> {
	return requestJson('/api/jwxt/sync', { method: 'POST', headers: { 'content-type': 'application/json' } });
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
	return requestJson('/api/jwxt/push', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
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
	return requestJson('/api/jwxt/search', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export async function jwxtEnroll(payload: { kchId: string; jxbId: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	return requestJson('/api/jwxt/enroll', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}

export async function jwxtDrop(payload: { kchId: string; jxbId: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	return requestJson('/api/jwxt/drop', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
}
