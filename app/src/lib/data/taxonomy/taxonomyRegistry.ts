import type { CourseCatalogEntry } from '../catalog/courseCatalog';
import type { CourseTaxonomyInfo } from '../../types/taxonomy';

interface TaxonomyOptions {
	colleges: string[];
	majors: string[];
	courseAttributes: string[];
}

type TermTaxonomyOverrides = Record<string, Record<string, CourseTaxonomyInfo>>;

// Populate per-term overrides here when curated metadata is available.
const TAXONOMY_OVERRIDES: TermTaxonomyOverrides = {};

let activeTermId: string | undefined;
let configuredTaxonomies = loadOverrides();
let cachedOptions: TaxonomyOptions = { colleges: [], majors: [], courseAttributes: [] };

export function initializeTaxonomyRegistry(termId: string, catalog: CourseCatalogEntry[]) {
	activeTermId = termId;
	configuredTaxonomies = loadOverrides(termId);
	cachedOptions = collectOptions(catalog);
}

export async function initializeTaxonomyRegistryAsync(termId: string, catalog: CourseCatalogEntry[]) {
	activeTermId = termId;
	configuredTaxonomies = loadOverrides(termId);
	cachedOptions = await collectOptionsAsync(catalog);
}

export function lookupConfiguredTaxonomy(courseCode: string): CourseTaxonomyInfo | undefined {
	return configuredTaxonomies.get(courseCode);
}

export function getTaxonomyOptions(): TaxonomyOptions {
	return cachedOptions;
}

function loadOverrides(termId?: string) {
	const overrides = TAXONOMY_OVERRIDES[termId ?? ''] ?? TAXONOMY_OVERRIDES.default ?? {};
	return new Map(Object.entries(overrides));
}

function collectOptions(catalog: CourseCatalogEntry[]): TaxonomyOptions {
	const colleges = new Set<string>();
	const majors = new Set<string>();
	const courseAttributes = new Set<string>();

	for (const entry of catalog) {
		const college = entry.taxonomy?.college ?? entry.college;
		const major = entry.taxonomy?.major ?? entry.major;
		const attr = entry.taxonomy?.courseAttribute ?? entry.courseAttribute;
		if (college && college !== '未标注') colleges.add(college);
		if (major && major !== '未标注') majors.add(major);
		if (attr && attr !== '未标注') courseAttributes.add(attr);
	}

	return {
		colleges: sortStrings(colleges),
		majors: sortStrings(majors),
		courseAttributes: sortStrings(courseAttributes)
	};
}

async function collectOptionsAsync(catalog: CourseCatalogEntry[]): Promise<TaxonomyOptions> {
	const colleges = new Set<string>();
	const majors = new Set<string>();
	const courseAttributes = new Set<string>();

	const yieldToEventLoop = async () => {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	};

	let budget = 0;
	for (const entry of catalog) {
		const college = entry.taxonomy?.college ?? entry.college;
		const major = entry.taxonomy?.major ?? entry.major;
		const attr = entry.taxonomy?.courseAttribute ?? entry.courseAttribute;
		if (college && college !== '未标注') colleges.add(college);
		if (major && major !== '未标注') majors.add(major);
		if (attr && attr !== '未标注') courseAttributes.add(attr);

		budget += 1;
		if (budget >= 800) {
			budget = 0;
			await yieldToEventLoop();
		}
	}

	return {
		colleges: sortStrings(colleges),
		majors: sortStrings(majors),
		courseAttributes: sortStrings(courseAttributes)
	};
}

function sortStrings(values: Set<string>): string[] {
	return Array.from(values)
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
