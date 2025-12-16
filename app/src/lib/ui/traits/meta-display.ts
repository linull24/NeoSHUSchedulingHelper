/**
 * Shared header/meta slots for cards & list items.
 * AppListCard/CourseCard use title/subtitle/meta slots to satisfy this.
 */
export interface MetaDisplay {
	title?: string | null;
	subtitle?: string | null;
	metaPills?: Array<{ label: string; tone?: 'neutral' | 'info' | 'warning' | 'danger' }>;
}
