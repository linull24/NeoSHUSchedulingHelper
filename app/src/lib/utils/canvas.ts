let canvasContext: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, number>();
const MEASURE_CACHE_MAX = 4000;

function getCanvasContext(): CanvasRenderingContext2D | null {
	if (typeof document === 'undefined') return null;
	if (!canvasContext) {
		const canvas = document.createElement('canvas');
		canvasContext = canvas.getContext('2d');
	}
	return canvasContext;
}

export function measureText(text: string, fontSize: number, fontFamily = 'sans-serif'): number {
	const key = `${fontSize}|${fontFamily}|${text}`;
	const cached = measureCache.get(key);
	if (typeof cached === 'number') return cached;

	const ctx = getCanvasContext();
	if (!ctx) {
		const fallback = text.length * fontSize * 0.6;
		measureCache.set(key, fallback);
		return fallback;
	}
	ctx.font = `${fontSize}px ${fontFamily}`;
	const width = ctx.measureText(text).width;
	measureCache.set(key, width);
	if (measureCache.size > MEASURE_CACHE_MAX) measureCache.clear();
	return width;
}
