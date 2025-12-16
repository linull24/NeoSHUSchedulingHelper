import type { Md5 } from './types';

function toHex(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function digestToMd5LikeHex(input: string): Promise<Md5> {
	const data = new TextEncoder().encode(input);
	if (globalThis.crypto?.subtle?.digest) {
		const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
		return toHex(hash).slice(0, 32) as Md5;
	}
	// SSR / scripts: fall back to Node's crypto.
	const nodeCrypto = await import('node:crypto');
	return nodeCrypto.createHash('sha256').update(data).digest('hex').slice(0, 32) as Md5;
}
