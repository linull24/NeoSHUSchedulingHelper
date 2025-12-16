import { z } from 'zod';
import type { TermState } from './types';
import { parseTermState } from './schema';
import { decodeBase64 } from '../utils/base64';

const zTermStateBundle = z.object({
	version: z.literal(1),
	generatedAt: z.number().int().nonnegative(),
	termId: z.string(),
	datasetSig: z.string(),
	termState: z.unknown()
});

export interface TermStateBundle {
	version: 1;
	generatedAt: number;
	termId: string;
	datasetSig: string;
	termState: TermState;
}

export function parseTermStateBundle(raw: unknown): TermStateBundle {
	const parsed = zTermStateBundle.parse(raw);
	const termState = parseTermState(parsed.termState);
	return {
		version: 1,
		generatedAt: parsed.generatedAt,
		termId: parsed.termId,
		datasetSig: parsed.datasetSig,
		termState
	};
}

export function parseTermStateBundleBase64(base64: string): TermStateBundle {
	const json = decodeBase64(base64);
	return parseTermStateBundle(JSON.parse(json));
}

