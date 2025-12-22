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
		msg.includes('GM REQUEST FAILED')
	);
}

