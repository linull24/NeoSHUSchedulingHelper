const CHUNK_SIZE = 0x8000;

export function encodeBase64(input: string) {
	const globalObj = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
	const bufferCtor = globalObj.Buffer as
		| { from?: (value: string | Uint8Array, encoding?: string) => { toString: (enc: string) => string } }
		| undefined;
	if (bufferCtor && typeof bufferCtor.from === 'function') {
		return bufferCtor.from(input, 'utf8').toString('base64');
	}
	const btoaFn = globalObj.btoa as ((value: string) => string) | undefined;
	const TextEncoderCtor = globalObj.TextEncoder as { new (): TextEncoder } | undefined;
	if (typeof btoaFn === 'function' && typeof TextEncoderCtor === 'function') {
		const encoder = new TextEncoderCtor();
		const bytes = encoder.encode(input);
		let binary = '';
		for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
			const slice = bytes.subarray(offset, offset + CHUNK_SIZE);
			binary += String.fromCharCode(...slice);
		}
		return btoaFn(binary);
	}
	throw new Error('无法生成 base64 数据');
}

export function decodeBase64(input: string) {
	const globalObj = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
	const bufferCtor = globalObj.Buffer as
		| { from?: (value: string, encoding: string) => { toString: (enc: string) => string } }
		| undefined;
	if (bufferCtor && typeof bufferCtor.from === 'function') {
		return bufferCtor.from(input, 'base64').toString('utf8');
	}
	const atobFn = globalObj.atob as ((value: string) => string) | undefined;
	const TextDecoderCtor = globalObj.TextDecoder as { new (): TextDecoder } | undefined;
	if (typeof atobFn === 'function' && typeof TextDecoderCtor === 'function') {
		const binary = atobFn(input);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) {
			bytes[i] = binary.charCodeAt(i);
		}
		const decoder = new TextDecoderCtor();
		return decoder.decode(bytes);
	}
	throw new Error('无法解码 base64 数据');
}
