export function stringifyError(error: unknown): string {
	if (error instanceof Error) return error.message || 'Error';
	try {
		return typeof error === 'string' ? error : JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export function isRetryableHttpStatus(status: number): boolean {
	// Conservative: retry only on server/network throttling failures.
	if (status >= 500) return true;
	if (status === 429) return true;
	return false;
}

export function isRetryableError(error: unknown): boolean {
	const msg = stringifyError(error).toUpperCase();
	return (
		msg.includes('TIMEOUT') ||
		msg.includes('NETWORK') ||
		msg.includes('ECONNRESET') ||
		msg.includes('ETIMEDOUT') ||
		msg.includes('GM REQUEST TIMEOUT') ||
		msg.includes('GM REQUEST FAILED') ||
		// JWXT-specific transient failures
		msg.includes('SESSION_INVALID') ||
		msg.includes('SELECTION_IS_LOCAL_LOGIN_HTML') ||
		msg.includes('SELECTION_REDIRECTED_TO_LOCAL_LOGIN') ||
		msg.includes('WARMUP_REDIRECTED_TO_LOCAL_LOGIN') ||
		msg.includes('VALIDATION_FAILED') ||
		msg.includes('SERVER_BUSY') ||
		/校验不通过|服务器繁忙|系统繁忙|请刷新|请稍后再试|尚未到|系统维护/.test(stringifyError(error))
	);
}
