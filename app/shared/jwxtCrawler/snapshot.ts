import { stripHtml } from './html';

export function stringify(value: unknown): string {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function normalizeText(raw: unknown): string {
	return stringify(raw).replace(/<br\s*\/?\s*>/gi, '; ').trim();
}

export function parseTeacher(text: unknown): { teacherId: string; teacherName: string; teacherTitle: string } {
	const segments = stringify(text)
		.split('/')
		.map((part) => part.trim())
		.filter(Boolean);
	return {
		teacherId: segments[0] || '',
		teacherName: segments[1] || '',
		teacherTitle: segments[2] || ''
	};
}

export function pickFirst(obj: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = obj[key];
		const text = stringify(value).trim();
		if (!text || text === '--') continue;
		return stripHtml(text);
	}
	return '';
}

export function buildLimitations(
	detail: Record<string, unknown>,
	base: { cxbj: string; fxbj: string }
): string[] {
	const notes: string[] = [];
	if (base.cxbj === '1') notes.push('仅限重修');
	if (base.fxbj === '1') notes.push('辅修班');
	if (stringify((detail as any).dsfrl).trim() === '1') notes.push('容量锁定');
	const cap = Number.parseInt(stringify((detail as any).jxbrl || (detail as any).capacity), 10);
	const num = Number.parseInt(stringify((detail as any).yxzrs || (detail as any).number), 10);
	if (Number.isFinite(cap) && Number.isFinite(num) && cap > 0 && num >= cap) notes.push('人数已满');
	return notes;
}

