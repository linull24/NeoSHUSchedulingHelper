<svelte:options runes={false} />

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import ConstraintStatusBox from '$lib/components/ConstraintStatusBox.svelte';
	import SolverListCard from '$lib/components/SolverListCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import CardBulkCheckbox from '$lib/components/CardBulkCheckbox.svelte';
	import SolverMinBatchControl from '$lib/components/SolverMinBatchControl.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { getFilterOptionsForScope } from '$lib/stores/courseFilters';
	import {
		courseCatalog,
		courseCatalogMap,
		courseDataset
	} from '$lib/data/catalog/courseCatalog';
	import type { CourseCatalogEntry } from '$lib/data/catalog/courseCatalog';
	import type { ManualUpdate } from '$lib/data/manualUpdates';
	import type { DesiredLock, SoftConstraint } from '$lib/data/desired/types';
import type { SectionEntry } from '$lib/data/InsaneCourseData';
import type { SolverResultRecord } from '$lib/data/solver/resultTypes';
	import { deriveGroupKey } from '$lib/data/termState/groupKey';
	import { crossCampusAllowed, homeCampus, setHomeCampus } from '$lib/stores/coursePreferences';
	import {
		clearTermStateAlert,
		dispatchTermAction,
		dispatchTermActionWithEffects,
		ensureTermStateLoaded,
		termState,
		termStateAlert
	} from '$lib/stores/termStateStore';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	const filterOptions = getFilterOptionsForScope('current');

	let message = '';
	let solving = false;
	let actionBusy = false;
	let applyMode: 'merge' | 'replace-all' = 'merge';

	let quickAddOpen: 'time' | 'teacher' | 'soft' | null = null;

	let timeDays = new Set<number>([0]);
	let timeStartPeriod = 1;
	let timeEndPeriod = 2;
	let timePriority: DesiredLock['priority'] = 'hard';
	let timeDirection: NonNullable<DesiredLock['direction']> = 'avoid';
	let timeNote = '';

	let teacherQuery = '';
	let teacherSelectedId: string | null = null;
	let teacherSuggestionsFocusedIndex: number | null = null;
	let teacherPriority: DesiredLock['priority'] = 'hard';
	let teacherDirection: NonNullable<DesiredLock['direction']> = 'desire';
	let teacherNote = '';

	let softType: SoftConstraint['type'] = 'avoid-early';
	let softWeight = 10;
	let softCampus = '';
	let softNote = '';

	let selectedLockIds = new Set<string>();
	let bulkLockPriority: DesiredLock['priority'] = 'hard';
	let bulkLockDirection: NonNullable<DesiredLock['direction']> = 'desire';

let selectedSoftIds = new Set<string>();
let bulkSoftWeight = 10;

	let editingSoftWeightId: string | null = null;
	let editingSoftWeightValue = '';
	let editingSoftWeightInput: HTMLInputElement | null = null;
	let editingBulkSoftWeight = false;
	let editingBulkSoftWeightValue = '';
	let editingBulkSoftWeightInput: HTMLInputElement | null = null;

	let convertingGroupLockId: string | null = null;
	let convertingGroupLockEntryId = '';
	let convertingGroupSoftId: string | null = null;
	let convertingGroupSoftEntryId = '';

type TriState = 'require' | 'forbid' | 'none';

type SolutionPreviewItem = {
	key: string;
	entry: CourseCatalogEntry | null;
	title: string;
	teacher: string | null;
	time: string;
	courseCode?: string;
	credit: number | null;
	capacity?: number;
	vacancy?: number;
	status?: 'limited' | 'full';
	specialTags: string[];
};

const calendarWeekdays = courseDataset.meta.calendarConfig?.weekdays ?? [];

let solutionPreviewItems: SolutionPreviewItem[] = [];
let solutionCount = 0;

	let courseEntriesByGroupKey = new Map<string, (typeof courseCatalog)[number][]>();

	const inputBaseClass =
		'rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]';
	const inputClass = `w-full ${inputBaseClass}`;
	const inputInlineClass = `w-auto ${inputBaseClass}`;
	const inputDenseBaseClass =
		'rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1.5 text-[var(--app-text-xs)] text-[var(--app-color-fg)]';
	const inputDenseInlineClass = `w-auto ${inputDenseBaseClass}`;

	onMount(() => void ensureTermStateLoaded());

	// Preserve insertion order so newly added constraints are easy to spot.
	$: locks = (($termState?.solver.constraints.locks ?? []) as unknown as DesiredLock[]).slice();
	$: lockById = new Map(locks.map((lock) => [lock.id, lock]));
	$: hardLocks = locks.filter((lock) => lock.priority === 'hard');
	$: softLocks = locks.filter((lock) => lock.priority === 'soft');
	$: courseEntriesByGroupKey = (() => {
		const map = new Map<string, (typeof courseCatalog)[number][]>();
		for (const entry of courseCatalog) {
			const groupKey = deriveGroupKey(entry) as unknown as string;
			const existing = map.get(groupKey);
			if (existing) existing.push(entry);
			else map.set(groupKey, [entry]);
		}
		for (const [groupKey, entries] of map.entries()) {
			map.set(
				groupKey,
				entries.slice().sort((a, b) => (a.slot ?? '').localeCompare(b.slot ?? '') || a.id.localeCompare(b.id))
			);
		}
		return map;
	})();
	$: visibleHardLocks = hardLocks;
	$: visibleSoftLocks = softLocks;
	$: visibleHardLockIds = new Set(visibleHardLocks.map((lock) => lock.id));
	$: visibleSoftLockIds = new Set(visibleSoftLocks.map((lock) => lock.id));
	$: selectedHardLockIds = new Set(Array.from(selectedLockIds).filter((id) => visibleHardLockIds.has(id)));
	$: selectedSoftLockIds = new Set(Array.from(selectedLockIds).filter((id) => visibleSoftLockIds.has(id)));
	// Preserve insertion order so newly added constraints are easy to spot.
	$: softConstraints = (($termState?.solver.constraints.soft ?? []) as unknown as SoftConstraint[]).slice();
	$: visibleSoftConstraints = softConstraints;
	$: catalogBySectionId = (() => {
		const map = new Map<string, (typeof courseCatalog)[number]>();
		for (const entry of courseCatalog) {
			if (!map.has(entry.sectionId)) map.set(entry.sectionId, entry);
		}
		return map;
	})();
	$: latestResult = $termState?.solver.results?.length ? $termState.solver.results[$termState.solver.results.length - 1] : null;
	$: invalidDialogOpen = $termStateAlert?.kind === 'SOLVER_INVALID_CONSTRAINTS';
	$: invalidIssues = $termStateAlert?.kind === 'SOLVER_INVALID_CONSTRAINTS' ? $termStateAlert.issues : [];
	$: stagingItems = ($termState?.solver.staging ?? []) as Array<{ kind: 'group' | 'section'; key: string }>;
	$: seedStagingDefaults(stagingItems);
	$: canUndoApply =
		!!$termState &&
		(($termState.history.entries ?? []).slice(0, $termState.history.cursor + 1) as any[]).some(
			(entry) => entry?.type === 'solver' && (entry?.details as any)?.kind === 'solver:apply'
		);
	$: solutionPreviewItems =
		latestResult && latestResult.status === 'sat' ? buildSolutionPreview(latestResult, t) : [];
	$: solutionCount = solutionPreviewItems.length;

	$: if (!softCampus) {
		const preferred = ($homeCampus ?? '').trim();
		if (preferred && filterOptions.campuses.includes(preferred)) {
			softCampus = preferred;
		} else if (filterOptions.campuses.length) {
			softCampus = filterOptions.campuses[0] ?? '';
		}
	}

function triStateFromBools({ require, forbid }: { require: boolean; forbid: boolean }): { value: TriState; conflict: boolean } {
		if (require && forbid) return { value: 'require', conflict: true };
		if (require) return { value: 'require', conflict: false };
		if (forbid) return { value: 'forbid', conflict: false };
		return { value: 'none', conflict: false };
}

function triStateFromDirection(direction: NonNullable<DesiredLock['direction']>): TriState {
	return direction === 'desire' ? 'require' : 'forbid';
}

function directionFromTriState(state: TriState): NonNullable<DesiredLock['direction']> {
	return state === 'require' ? 'desire' : 'avoid';
}

function resolveEntryForSectionId(sectionId: string): CourseCatalogEntry | null {
	const direct = courseCatalogMap.get(sectionId);
	if (direct) return direct;
	const loose = courseCatalog.find((item) => item.sectionId === sectionId);
	return loose ?? null;
}

function buildSolutionPreview(record: SolverResultRecord, t: TranslateFn): SolutionPreviewItem[] {
	const items = new Map<string, SolutionPreviewItem>();

	const pushItem = ({
		key,
		entry,
		section,
		courseHash,
		courseCode
	}: {
		key: string;
		entry: CourseCatalogEntry | null;
		section: SectionEntry | null;
		courseHash?: string | null;
		courseCode?: string | null;
	}) => {
		const title = entry?.title ?? section?.attributes?.title ?? section?.attributes?.name ?? section?.sectionId ?? key;
		const teacher = entry?.teacher ?? formatTeachersFromSection(section);
		const time = entry?.slot ?? formatScheduleChunks(section);
		const credit = entry?.credit ?? (section?.attributes?.credit ? Number(section.attributes.credit) : null);
		const capacity = entry?.capacity ?? (section?.attributes?.capacity ? Number(section.attributes.capacity) : undefined);
		const vacancy = entry?.vacancy ?? (section?.attributes?.vacancy ? Number(section.attributes.vacancy) : undefined);

		items.set(key, {
			key,
			entry,
			title: title || t('courseCard.courseCodePending'),
			teacher: teacher ?? null,
			time: time ?? t('courseCard.noTime'),
			courseCode: entry?.courseCode ?? courseCode ?? undefined,
			credit: typeof credit === 'number' && Number.isFinite(credit) ? credit : null,
			capacity,
			vacancy,
			status: entry?.status,
			specialTags: entry?.specialTags ?? []
		});
	};

	// Prefer full assignment if present.
	const assignmentEntries = Object.entries(record.assignment ?? {}).filter(([, value]) => value === true);
	if (assignmentEntries.length) {
		for (const [sectionId] of assignmentEntries) {
			const entry = resolveEntryForSectionId(sectionId);
			if (entry) {
				pushItem({ key: sectionId, entry, section: null, courseHash: entry.courseHash, courseCode: entry.courseCode });
				continue;
			}
			// Fallback: try to match plan upserts by sectionId.
			const fromPlan = record.plan.find(
				(update): update is ManualUpdate & { kind: 'upsert-section' } =>
					update.kind === 'upsert-section' && update.section.sectionId === sectionId
			);
			if (fromPlan) {
				pushItem({
					key: sectionId,
					entry: null,
					section: fromPlan.section,
					courseHash: fromPlan.courseHash,
					courseCode: fromPlan.courseCode
				});
			}
		}
	}

	// If assignment missing/empty, derive from plan upserts.
	if (!items.size) {
		record.plan
			.filter((update): update is ManualUpdate & { kind: 'upsert-section' } => update.kind === 'upsert-section')
			.forEach((update, index) => {
				const sectionId = update.section.sectionId;
				const courseHash = update.courseHash;
				const key = sectionId ? `${courseHash ?? 'plan'}:${sectionId}:${index}` : `plan:${index}`;
				const entry =
					(sectionId && courseHash ? courseCatalogMap.get(`${courseHash}:${sectionId}`) ?? null : null) ??
					(sectionId ? resolveEntryForSectionId(sectionId) : null);
				pushItem({ key, entry, section: update.section, courseHash, courseCode: update.courseCode });
			});
	}

	return Array.from(items.values());
}

function formatTeachersFromSection(section: SectionEntry | null): string | null {
	if (!section?.teachers?.length) return null;
	const names = section.teachers.map((teacher) => teacher.name).filter(Boolean);
	return names.length ? names.join('、') : null;
}

function formatScheduleChunks(section: SectionEntry | null): string | null {
	if (!section?.scheduleChunks?.length) return null;
	const weekdayLabels =
		calendarWeekdays.length >= 7
			? calendarWeekdays
			: [
					t('courseCatalog.weekdays.monday'),
					t('courseCatalog.weekdays.tuesday'),
					t('courseCatalog.weekdays.wednesday'),
					t('courseCatalog.weekdays.thursday'),
					t('courseCatalog.weekdays.friday'),
					t('courseCatalog.weekdays.saturday'),
					t('courseCatalog.weekdays.sunday')
			  ];
	return section.scheduleChunks
		.map((chunk) => {
			const dayLabel = weekdayLabels[chunk.day] ?? t('panels.solver.weekdayFallback', { index: chunk.day + 1 });
			const start = chunk.startPeriod + 1;
			const end = chunk.endPeriod + 1;
			const period =
				start === end
					? t('panels.solver.periodSingle', { index: start })
					: t('panels.solver.periodRange', { start, end });
			return `${dayLabel} ${period}`;
		})
		.join(' / ');
}

// Pending items are imported via course lists (bulk action: importSolver).

	$: activePreferenceSeed = (() => {
		const groupHardFlags = new Map<string, { require: boolean; forbid: boolean }>();
		const groupSoftFlags = new Map<string, { require: boolean; forbid: boolean; requireWeight: number; forbidWeight: number }>();

		const sectionHardFlags = new Map<string, { require: boolean; forbid: boolean }>();
		const sectionSoftFlags = new Map<string, { require: boolean; forbid: boolean; requireWeight: number; forbidWeight: number }>();

		for (const lock of locks) {
			if (lock.type === 'group' && lock.priority === 'hard') {
				const groupKey = groupKeyFromGroupLock(lock);
				if (!groupKey) continue;
				const flags = groupHardFlags.get(groupKey) ?? { require: false, forbid: false };
				if (lock.direction === 'desire') flags.require = true;
				if (lock.direction === 'avoid') flags.forbid = true;
				groupHardFlags.set(groupKey, flags);
				continue;
			}

			if (lock.type === 'section' && lock.priority === 'hard') {
				const courseHash = (lock.courseHash ?? '').trim();
				const sectionId = (lock.sectionId ?? '').trim();
				const entryId = courseHash && sectionId ? `${courseHash}:${sectionId}` : '';
				const entry =
					(entryId ? courseCatalogMap.get(entryId) ?? null : null) ??
					(sectionId ? resolveEntryBySectionId(sectionId) : null);
				if (!entry) continue;
				const flags = sectionHardFlags.get(entry.id) ?? { require: false, forbid: false };
				if (lock.direction === 'desire') flags.require = true;
				if (lock.direction === 'avoid') flags.forbid = true;
				sectionHardFlags.set(entry.id, flags);
				continue;
			}
		}

		for (const constraint of softConstraints) {
			if (constraint.type === 'prefer-group' || constraint.type === 'avoid-group') {
				const groupKey = typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : '';
				if (!groupKey) continue;
				const flags = groupSoftFlags.get(groupKey) ?? { require: false, forbid: false, requireWeight: 10, forbidWeight: 10 };
				if (constraint.type === 'prefer-group') {
					flags.require = true;
					flags.requireWeight = Math.max(flags.requireWeight, constraint.weight);
				}
				if (constraint.type === 'avoid-group') {
					flags.forbid = true;
					flags.forbidWeight = Math.max(flags.forbidWeight, constraint.weight);
				}
				groupSoftFlags.set(groupKey, flags);
				continue;
			}

			if (constraint.type === 'prefer-section' || constraint.type === 'avoid-section') {
				const sectionId = typeof constraint.params?.sectionId === 'string' ? constraint.params.sectionId : '';
				if (!sectionId) continue;
				const entry = resolveEntryBySectionId(sectionId);
				if (!entry) continue;
				const flags =
					sectionSoftFlags.get(entry.id) ?? { require: false, forbid: false, requireWeight: 10, forbidWeight: 10 };
				if (constraint.type === 'prefer-section') {
					flags.require = true;
					flags.requireWeight = Math.max(flags.requireWeight, constraint.weight);
				}
				if (constraint.type === 'avoid-section') {
					flags.forbid = true;
					flags.forbidWeight = Math.max(flags.forbidWeight, constraint.weight);
				}
				sectionSoftFlags.set(entry.id, flags);
				continue;
			}
		}

		const groupHard = new Map<string, TriState>();
		const groupSoft = new Map<string, { state: TriState; weight: number }>();
		const sectionHard = new Map<string, TriState>();
		const sectionSoft = new Map<string, { state: TriState; weight: number }>();

		for (const [groupKey, flags] of groupHardFlags.entries()) {
			const tri = triStateFromBools(flags);
			groupHard.set(groupKey, tri.conflict ? 'none' : tri.value);
		}
		for (const [groupKey, flags] of groupSoftFlags.entries()) {
			const tri = triStateFromBools(flags);
			const state = tri.conflict ? 'none' : tri.value;
			const weight = state === 'require' ? flags.requireWeight : state === 'forbid' ? flags.forbidWeight : 10;
			groupSoft.set(groupKey, { state, weight });
		}
		for (const [entryId, flags] of sectionHardFlags.entries()) {
			const tri = triStateFromBools(flags);
			sectionHard.set(entryId, tri.conflict ? 'none' : tri.value);
		}
		for (const [entryId, flags] of sectionSoftFlags.entries()) {
			const tri = triStateFromBools(flags);
			const state = tri.conflict ? 'none' : tri.value;
			const weight = state === 'require' ? flags.requireWeight : state === 'forbid' ? flags.forbidWeight : 10;
			sectionSoft.set(entryId, { state, weight });
		}

		return { groupHard, groupSoft, sectionHard, sectionSoft };
	})();

	type TeacherCandidate = {
		teacherId: string;
		name: string;
	};

	function normalizeTeacherToken(value: string) {
		return value.trim().toLowerCase();
	}

	$: teacherIndex = (() => {
		const byId = new Map<string, TeacherCandidate>();
		const idsByName = new Map<string, Set<string>>();

		for (const course of courseDataset.courses ?? []) {
			const courseTeacherId = (course.teacherCode ?? '').trim();
			const courseTeacherName = (course.teacherName ?? '').trim();
			if (courseTeacherId && courseTeacherName && !byId.has(courseTeacherId)) {
				byId.set(courseTeacherId, { teacherId: courseTeacherId, name: courseTeacherName });
			}
			if (courseTeacherId && courseTeacherName) {
				const set = idsByName.get(courseTeacherName) ?? new Set<string>();
				set.add(courseTeacherId);
				idsByName.set(courseTeacherName, set);
			}

			for (const section of course.sections ?? []) {
				for (const teacher of section.teachers ?? []) {
					const teacherId = (teacher.teacherId ?? '').trim();
					const name = (teacher.name ?? '').trim();
					if (!teacherId) continue;
					if (!byId.has(teacherId)) byId.set(teacherId, { teacherId, name });
					if (!name) continue;
					const key = name.trim();
					const set = idsByName.get(key) ?? new Set<string>();
					set.add(teacherId);
					idsByName.set(key, set);
				}
			}
		}

		for (const entry of courseCatalog) {
			const teacherId = (entry.teacherId ?? '').trim();
			if (!teacherId || byId.has(teacherId)) continue;
			const name = (entry.teacher ?? '').trim();
			byId.set(teacherId, { teacherId, name });
			if (name) {
				const set = idsByName.get(name) ?? new Set<string>();
				set.add(teacherId);
				idsByName.set(name, set);
			}
		}

		const candidates = Array.from(byId.values()).sort(
			(a, b) => a.name.localeCompare(b.name) || a.teacherId.localeCompare(b.teacherId)
		);

		return { byId, idsByName, candidates };
	})();

	function resolveTeacherId(query: string) {
		const token = query.trim();
		if (!token) return null;

		if (teacherSelectedId) return teacherSelectedId;

		const direct = teacherIndex.byId.get(token);
		if (direct) return direct.teacherId;

		const ids = teacherIndex.idsByName.get(token);
		if (ids && ids.size === 1) return Array.from(ids)[0] ?? null;
		return null;
	}

	function teacherCandidateLabel(candidate: TeacherCandidate) {
		const name = candidate.name.trim();
		return name ? `${name} · ${candidate.teacherId}` : candidate.teacherId;
	}

	function scoreTeacherCandidate(candidate: TeacherCandidate, query: string) {
		const q = normalizeTeacherToken(query);
		if (!q) return null;
		const id = normalizeTeacherToken(candidate.teacherId);
		const name = normalizeTeacherToken(candidate.name);

		if (id === q) return 0;
		if (name === q) return 1;
		if (name.startsWith(q)) return 2;
		if (id.startsWith(q)) return 3;
		if (name.includes(q)) return 4;
		if (id.includes(q)) return 5;
		return null;
	}

	$: teacherSuggestions = (() => {
		if (teacherSelectedId) return [];
		const q = teacherQuery.trim();
		if (!q) return [];
		const ranked: Array<{ candidate: TeacherCandidate; score: number }> = [];
		for (const candidate of teacherIndex.candidates) {
			const score = scoreTeacherCandidate(candidate, q);
			if (score == null) continue;
			ranked.push({ candidate, score });
		}
		ranked.sort(
			(a, b) =>
				a.score - b.score ||
				a.candidate.name.length - b.candidate.name.length ||
				a.candidate.name.localeCompare(b.candidate.name) ||
				a.candidate.teacherId.localeCompare(b.candidate.teacherId)
		);
		return ranked.slice(0, 8).map((item) => item.candidate);
	})();

	$: resolvedTeacherId = resolveTeacherId(teacherQuery);
	$: resolvedTeacherCandidate = resolvedTeacherId ? teacherIndex.byId.get(resolvedTeacherId) ?? null : null;
	$: resolvedTeacherLabel = resolvedTeacherCandidate
		? teacherCandidateLabel(resolvedTeacherCandidate)
		: resolvedTeacherId ?? '';

	function createId(prefix: string) {
		const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
		if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;
		return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	}

	function parseEntryId(entryId: string) {
		const raw = entryId;
		const sep = raw.indexOf(':');
		if (sep === -1) return { courseHash: raw, sectionId: raw };
		return { courseHash: raw.slice(0, sep), sectionId: raw.slice(sep + 1) };
	}

	let stagingHardState = new Map<string, TriState>();
	let stagingSoftState = new Map<string, TriState>();
	let stagingSoftWeight = new Map<string, number>();
	let expandedStagingGroups = new Set<string>();

	type GroupInlineMode = 'preferences' | 'allow-only';
	type GroupInlineState = {
		mode: GroupInlineMode;
		allowed: Set<string>;
		selected: Set<string>;
		priority: DesiredLock['priority'];
		weight: number;
	};
	let groupInline = new Map<string, GroupInlineState>();

	function stagingKey(item: { kind: 'group' | 'section'; key: string }) {
		return `${item.kind}:${item.key}`;
	}

	function getStagingHardState(item: { kind: 'group' | 'section'; key: string }): TriState {
		return stagingHardState.get(stagingKey(item)) ?? 'none';
	}

	function setStagingHardState(item: { kind: 'group' | 'section'; key: string }, value: TriState) {
		const key = stagingKey(item);
		if (stagingHardState.get(key) === value) return;
		stagingHardState = new Map(stagingHardState);
		stagingHardState.set(key, value);
	}

	function getStagingSoftState(item: { kind: 'group' | 'section'; key: string }): TriState {
		return stagingSoftState.get(stagingKey(item)) ?? 'none';
	}

	function setStagingSoftState(item: { kind: 'group' | 'section'; key: string }, value: TriState) {
		const key = stagingKey(item);
		if (stagingSoftState.get(key) === value) return;
		stagingSoftState = new Map(stagingSoftState);
		stagingSoftState.set(key, value);
	}

	function getStagingSoftWeight(item: { kind: 'group' | 'section'; key: string }) {
		const key = stagingKey(item);
		return stagingSoftWeight.get(key) ?? 10;
	}

	function setStagingSoftWeight(item: { kind: 'group' | 'section'; key: string }, weight: number) {
		const key = stagingKey(item);
		if (stagingSoftWeight.get(key) === weight) return;
		stagingSoftWeight = new Map(stagingSoftWeight);
		stagingSoftWeight.set(key, weight);
	}

	function clearStagingLocalItem(item: { kind: 'group' | 'section'; key: string }) {
		const key = stagingKey(item);

		if (stagingHardState.has(key)) {
			stagingHardState = new Map(stagingHardState);
			stagingHardState.delete(key);
		}
		if (stagingSoftState.has(key)) {
			stagingSoftState = new Map(stagingSoftState);
			stagingSoftState.delete(key);
		}
		if (stagingSoftWeight.has(key)) {
			stagingSoftWeight = new Map(stagingSoftWeight);
			stagingSoftWeight.delete(key);
		}
		if (item.kind === 'group') {
			if (expandedStagingGroups.has(item.key)) {
				expandedStagingGroups = new Set(expandedStagingGroups);
				expandedStagingGroups.delete(item.key);
			}
			if (groupInline.has(item.key)) {
				groupInline = new Map(groupInline);
				groupInline.delete(item.key);
			}
		}
	}

	function resetStagingLocalState() {
		stagingHardState = new Map();
		stagingSoftState = new Map();
		stagingSoftWeight = new Map();
		expandedStagingGroups = new Set();
		groupInline = new Map();
	}

	function ensureGroupInline(groupKey: string) {
		const existing = groupInline.get(groupKey);
		if (existing) return existing;
		const entries = getGroupEntries(groupKey);
		const sectionIds = Array.from(new Set(entries.map((e) => e.sectionId).filter(Boolean))).sort();
		const next: GroupInlineState = {
			mode: 'preferences',
			allowed: new Set(sectionIds),
			selected: new Set(),
			priority: 'hard',
			weight: 10
		};
		groupInline = new Map(groupInline);
		groupInline.set(groupKey, next);
		return next;
	}

	function setGroupInline(groupKey: string, patch: Partial<GroupInlineState>) {
		const current = ensureGroupInline(groupKey);
		const next: GroupInlineState = {
			...current,
			...patch,
			allowed: patch.allowed ?? current.allowed,
			selected: patch.selected ?? current.selected
		};
		groupInline = new Map(groupInline);
		groupInline.set(groupKey, next);
	}

	function toggleGroupExpanded(groupKey: string) {
		const next = new Set(expandedStagingGroups);
		if (next.has(groupKey)) next.delete(groupKey);
		else next.add(groupKey);
		expandedStagingGroups = next;
		ensureGroupInline(groupKey);
	}

	function getGroupEntries(groupKey: string) {
		return courseEntriesByGroupKey.get(groupKey) ?? [];
	}


	async function addTimeLock() {
		message = '';
		const startPeriod = Math.max(1, Math.floor(timeStartPeriod));
		const endPeriod = Math.max(1, Math.floor(timeEndPeriod));
		const dayList = Array.from(timeDays).sort();
		if (!dayList.length) return;

		for (const day of dayList) {
			const lock: DesiredLock = {
				id: createId('lock'),
				type: 'time',
				timeWindow: {
					day,
					startPeriod,
					endPeriod
				},
				priority: timePriority,
				direction: timeDirection,
				note: timeNote || undefined
			};
			const result = await dispatchTermAction({ type: 'SOLVER_ADD_LOCK', lock });
			if (!result.ok) {
				message = result.error.message;
				return;
			}
		}
		timeNote = '';
	}

	async function removeLock(id: string) {
		message = '';
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id });
		if (!result.ok) message = result.error.message;
	}

	async function addTeacherLock() {
		message = '';
		const teacherId = resolvedTeacherId;
		if (!teacherId) {
			message = t('panels.solver.teacherResolveError');
			return;
		}
		const lock: DesiredLock = {
			id: createId('lock'),
			type: 'teacher',
			teacherId: teacherId.trim(),
			priority: teacherPriority,
			direction: teacherDirection,
			note: teacherNote || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_LOCK', lock });
		if (!result.ok) message = result.error.message;
		teacherNote = '';
	}

	async function addSoftConstraint() {
		message = '';
		const params: Record<string, string | number | boolean> = {};
		if (softType === 'avoid-campus' && softCampus) params.campus = softCampus;
		const constraint: SoftConstraint = {
			id: createId('soft'),
			type: softType,
			weight: Math.max(1, Math.round(softWeight)),
			params: Object.keys(params).length ? params : undefined,
			note: softNote || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_SOFT', constraint });
		if (!result.ok) message = result.error.message;
		softNote = '';
	}

	function toggleSelectedLock(id: string) {
		const next = new Set(selectedLockIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedLockIds = next;
	}

	function toggleSelectedSoft(id: string) {
		const next = new Set(selectedSoftIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedSoftIds = next;
	}

	function clearSelectedLocks(ids: Set<string>) {
		if (!ids.size) return;
		const next = new Set(selectedLockIds);
		for (const id of ids) next.delete(id);
		selectedLockIds = next;
	}

	async function updateLockInline(id: string, patch: Partial<DesiredLock>) {
		const result = await dispatchTermAction({ type: 'SOLVER_UPDATE_LOCK', id, patch });
		if (!result.ok) message = result.error.message;
	}

	async function handleLockPriorityChange({
		lock,
		nextPriority,
		direction
	}: {
		lock: DesiredLock;
		nextPriority: DesiredLock['priority'];
		direction: NonNullable<DesiredLock['direction']>;
	}) {
		if (lock.type === 'section') {
			const courseHash = (lock.courseHash ?? '').trim();
			const sectionId = (lock.sectionId ?? '').trim();
			if (!courseHash || !sectionId) {
				message = t('dialogs.solverInvalid.reasons.lock.sectionNotFound');
				return;
			}
			await applySectionPreference({
				courseHash,
				sectionId,
				priority: nextPriority,
				direction,
				weight: 10,
				note: lock.note
			});
			return;
		}

		if (lock.type === 'group' && nextPriority === 'soft') {
			const groupKey = groupKeyFromGroupLock(lock);
			if (groupKey) {
				const removed = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id: lock.id });
				if (!removed.ok) {
					message = removed.error.message;
					return;
				}
				await upsertGroupSoftPreference({ groupKey, direction, weight: 10, note: lock.note });
				return;
			}
		}

		await updateLockInline(lock.id, { priority: nextPriority });
	}

	async function applyBulkLockPatch(ids: Set<string>) {
		const idList = Array.from(ids);
		if (!idList.length) return;
		for (const id of idList) {
			const lock = lockById.get(id);
			if (lock && lock.type === 'section') {
				const courseHash = (lock.courseHash ?? '').trim();
				const sectionId = (lock.sectionId ?? '').trim();
				if (!courseHash || !sectionId) {
					message = t('dialogs.solverInvalid.reasons.lock.sectionNotFound');
					return;
				}
				await applySectionPreference({
					courseHash,
					sectionId,
					priority: bulkLockPriority,
					direction: bulkLockDirection,
					weight: 10,
					note: lock.note
				});
				continue;
			}

			if (lock && lock.type === 'group' && bulkLockPriority === 'soft') {
				const groupKey = groupKeyFromGroupLock(lock);
				if (groupKey) {
					const removed = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id: lock.id });
					if (!removed.ok) {
						message = removed.error.message;
						return;
					}
					await upsertGroupSoftPreference({ groupKey, direction: bulkLockDirection, weight: 10, note: lock.note });
					continue;
				}
			}

			const result = await dispatchTermAction({
				type: 'SOLVER_UPDATE_LOCK',
				id,
				patch: { priority: bulkLockPriority, direction: bulkLockDirection }
			});
			if (!result.ok) {
				message = result.error.message;
				return;
			}
		}
		clearSelectedLocks(ids);
	}

	async function removeSelectedLocks(ids: Set<string>) {
		const idList = Array.from(ids);
		if (!idList.length) return;
		for (const id of idList) {
			const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id });
			if (!result.ok) {
				message = result.error.message;
				return;
			}
		}
		clearSelectedLocks(ids);
	}

	async function updateSoftInline(id: string, patch: Partial<SoftConstraint>) {
		const result = await dispatchTermAction({ type: 'SOLVER_UPDATE_SOFT', id, patch });
		if (!result.ok) message = result.error.message;
	}

	function resolveEntryBySectionId(sectionId: string) {
		return catalogBySectionId.get(sectionId) ?? null;
	}

	function isSectionPreferenceSoft(constraint: SoftConstraint) {
		return constraint.type === 'avoid-section' || constraint.type === 'prefer-section';
	}

	function isGroupPreferenceSoft(constraint: SoftConstraint) {
		return constraint.type === 'avoid-group' || constraint.type === 'prefer-group';
	}

	function softDirectionFromType(constraint: SoftConstraint): NonNullable<DesiredLock['direction']> | null {
		if (constraint.type === 'avoid-section' || constraint.type === 'avoid-group') return 'avoid';
		if (constraint.type === 'prefer-section' || constraint.type === 'prefer-group') return 'desire';
		return null;
	}

	async function beginSoftWeightEdit(constraint: SoftConstraint) {
		editingSoftWeightId = constraint.id;
		editingSoftWeightValue = String(constraint.weight);
		await tick();
		editingSoftWeightInput?.focus();
		editingSoftWeightInput?.select();
	}

	async function commitSoftWeightEdit(id: string) {
		const next = Math.max(1, Math.round(Number(editingSoftWeightValue)));
		if (!Number.isFinite(next)) {
			editingSoftWeightId = null;
			return;
		}
		await updateSoftInline(id, { weight: next });
		editingSoftWeightId = null;
	}

	function cancelSoftWeightEdit() {
		editingSoftWeightId = null;
	}

	async function beginBulkSoftWeightEdit() {
		editingBulkSoftWeight = true;
		editingBulkSoftWeightValue = String(bulkSoftWeight);
		await tick();
		editingBulkSoftWeightInput?.focus();
		editingBulkSoftWeightInput?.select();
	}

	function commitBulkSoftWeightEdit() {
		const next = Math.max(1, Math.round(Number(editingBulkSoftWeightValue)));
		if (Number.isFinite(next)) bulkSoftWeight = next;
		editingBulkSoftWeight = false;
	}

	function cancelBulkSoftWeightEdit() {
		editingBulkSoftWeight = false;
	}

	function groupKeyFromGroupLock(lock: DesiredLock): string | null {
		if (lock.type !== 'group') return null;
		const sectionId = lock.includeSections?.find(Boolean) ?? '';
		if (sectionId) {
			const entry = resolveEntryBySectionId(sectionId);
			if (entry) return deriveGroupKey(entry) as unknown as string;
		}
		const courseHash = lock.group?.courseHashes?.find(Boolean) ?? '';
		if (!courseHash) return null;
		const entry = courseCatalog.find((item) => item.courseHash === courseHash) ?? null;
		if (!entry) return null;
		const key = deriveGroupKey(entry) as unknown as string;
		const mismatched = (lock.group?.courseHashes ?? [])
			.filter(Boolean)
			.some((hash) => {
				const e = courseCatalog.find((item) => item.courseHash === hash) ?? null;
				if (!e) return false;
				return (deriveGroupKey(e) as unknown as string) !== key;
			});
		return mismatched ? null : key;
	}

	function groupLockCandidateEntries(lock: DesiredLock) {
		if (lock.type !== 'group') return [];
		const includeSectionIds = (lock.includeSections ?? []).filter(Boolean);
		if (includeSectionIds.length) {
			return includeSectionIds
				.map((sectionId) => resolveEntryBySectionId(sectionId))
				.filter(Boolean) as Array<(typeof courseCatalog)[number]>;
		}
		const courseHashes = new Set((lock.group?.courseHashes ?? []).filter(Boolean));
		if (!courseHashes.size) return [];
		return courseCatalog.filter((entry) => courseHashes.has(entry.courseHash));
	}

	async function upsertGroupSoftPreference({
		groupKey,
		direction,
		weight,
		note
	}: {
		groupKey: string;
		direction: NonNullable<DesiredLock['direction']>;
		weight: number;
		note?: string;
	}) {
		message = '';
		const softType: SoftConstraint['type'] = direction === 'avoid' ? 'avoid-group' : 'prefer-group';
		const oppositeType: SoftConstraint['type'] = direction === 'avoid' ? 'prefer-group' : 'avoid-group';
		const finalWeight = Math.max(1, Math.round(weight));

		const sameType = softConstraints
			.filter((c) => c.type === softType && c.params?.groupKey === groupKey)
			.slice()
			.sort((a, b) => a.id.localeCompare(b.id));
		const keep = sameType[0] ?? null;
		const pruneIds = sameType
			.slice(1)
			.map((c) => c.id)
			.concat(softConstraints.filter((c) => c.type === oppositeType && c.params?.groupKey === groupKey).map((c) => c.id));
		if (pruneIds.length) {
			const removed = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids: pruneIds });
			if (!removed.ok) {
				message = removed.error.message;
				return;
			}
		}

		if (keep) {
			const result = await dispatchTermAction({
				type: 'SOLVER_UPDATE_SOFT',
				id: keep.id,
				patch: { weight: finalWeight, note: note?.trim() || undefined }
			});
			if (!result.ok) message = result.error.message;
			return;
		}

		const constraint: SoftConstraint = {
			id: createId('soft'),
			type: softType,
			weight: finalWeight,
			params: { groupKey },
			note: note?.trim() || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_SOFT', constraint });
		if (!result.ok) message = result.error.message;
	}

	async function removeGroupSoftForGroupKey(groupKey: string) {
		const ids = softConstraints
			.filter((c) => (c.type === 'avoid-group' || c.type === 'prefer-group') && c.params?.groupKey === groupKey)
			.map((c) => c.id);
		if (!ids.length) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	async function convertSectionLockToGroup(lock: DesiredLock, direction: NonNullable<DesiredLock['direction']>) {
		if (lock.type !== 'section') return;
		const courseHash = (lock.courseHash ?? '').trim();
		const sectionId = (lock.sectionId ?? '').trim();
		const entry =
			(courseHash && sectionId ? courseCatalogMap.get(`${courseHash}:${sectionId}`) ?? null : null) ??
			(sectionId ? resolveEntryBySectionId(sectionId) : null);
		if (!entry) {
			message = t('panels.solver.groupAllowed.missingGroup');
			return;
		}
		const groupKey = deriveGroupKey(entry) as unknown as string;
		const entries = getGroupEntries(groupKey);
		const courseHashes = Array.from(new Set(entries.map((e) => e.courseHash))).filter(Boolean).sort();
		if (!courseHashes.length) {
			message = t('panels.solver.groupAllowed.missingGroup');
			return;
		}

		const ok1 = await removeSectionLocksForSectionId(sectionId);
		if (!ok1) return;
		const ok2 = await removeSectionSoftForSectionId(sectionId);
		if (!ok2) return;

		if (lock.priority === 'soft') {
			await upsertGroupSoftPreference({ groupKey, direction, weight: 10, note: lock.note });
			return;
		}

		await upsertGroupLock({
			groupKey,
			courseHashes,
			priority: lock.priority,
			direction,
			note: lock.note
		});
	}

	async function convertGroupLockToSection(lock: DesiredLock, entryId: string, direction: NonNullable<DesiredLock['direction']>) {
		if (lock.type !== 'group') return;
		const entry = courseCatalogMap.get(entryId);
		if (!entry) {
			message = t('dialogs.solverInvalid.reasons.lock.sectionNotFound');
			return;
		}
		const removed = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id: lock.id });
		if (!removed.ok) {
			message = removed.error.message;
			return;
		}
		await applySectionPreference({
			courseHash: entry.courseHash,
			sectionId: entry.sectionId,
			priority: lock.priority,
			direction,
			weight: 10,
			note: lock.note
		});
		convertingGroupLockId = null;
		convertingGroupLockEntryId = '';
	}

	async function convertSoftSectionToGroup(constraint: SoftConstraint) {
		if (!isSectionPreferenceSoft(constraint)) return;
		const sectionId = typeof constraint.params?.sectionId === 'string' ? constraint.params.sectionId : '';
		const entry = sectionId ? resolveEntryBySectionId(sectionId) : null;
		if (!entry) {
			message = t('dialogs.solverInvalid.reasons.soft.sectionNotFound');
			return;
		}
		const groupKey = deriveGroupKey(entry) as unknown as string;
		const direction = softDirectionFromType(constraint);
		if (!direction) return;

		const ok1 = await removeSectionLocksForSectionId(sectionId);
		if (!ok1) return;
		const ok2 = await removeSectionSoftForSectionId(sectionId);
		if (!ok2) return;

		await upsertGroupSoftPreference({
			groupKey,
			direction,
			weight: constraint.weight,
			note: constraint.note
		});
	}

	async function convertSoftGroupToSection(constraint: SoftConstraint, entryId: string) {
		if (!isGroupPreferenceSoft(constraint)) return;
		const groupKey = typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : '';
		if (!groupKey) return;
		const entry = courseCatalogMap.get(entryId);
		if (!entry) {
			message = t('dialogs.solverInvalid.reasons.lock.sectionNotFound');
			return;
		}
		const direction = softDirectionFromType(constraint);
		if (!direction) return;
		const ok = await removeGroupSoftForGroupKey(groupKey);
		if (!ok) return;

		await applySectionPreference({
			courseHash: entry.courseHash,
			sectionId: entry.sectionId,
			priority: 'soft',
			direction,
			weight: constraint.weight,
			note: constraint.note
		});
		convertingGroupSoftId = null;
		convertingGroupSoftEntryId = '';
	}

	async function convertSoftGroupToHardLock(constraint: SoftConstraint) {
		if (!isGroupPreferenceSoft(constraint)) return;
		const groupKey = typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : '';
		if (!groupKey) return;
		const direction = softDirectionFromType(constraint);
		if (!direction) return;
		const entries = getGroupEntries(groupKey);
		const courseHashes = Array.from(new Set(entries.map((e) => e.courseHash))).filter(Boolean).sort();
		if (!courseHashes.length) {
			message = t('panels.solver.groupAllowed.missingGroup');
			return;
		}
		const ok = await removeGroupSoftForGroupKey(groupKey);
		if (!ok) return;
		await upsertGroupLock({
			groupKey,
			courseHashes,
			priority: 'hard',
			direction,
			note: constraint.note
		});
	}

	async function applyBulkSoftWeight() {
		const ids = Array.from(selectedSoftIds);
		if (!ids.length) return;
		const weight = Math.max(1, Math.round(bulkSoftWeight));
		for (const id of ids) {
			const result = await dispatchTermAction({ type: 'SOLVER_UPDATE_SOFT', id, patch: { weight } });
			if (!result.ok) {
				message = result.error.message;
				return;
			}
		}
		selectedSoftIds = new Set();
	}

	async function removeSelectedSoft() {
		const ids = Array.from(selectedSoftIds);
		if (!ids.length) return;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return;
		}
		selectedSoftIds = new Set();
	}

	async function removeSectionLocksForSectionId(sectionId: string) {
		const ids = locks.filter((l) => l.type === 'section' && l.sectionId === sectionId).map((l) => l.id);
		if (!ids.length) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	async function removeSectionSoftForSectionId(sectionId: string) {
		const ids = softConstraints
			.filter((c) => (c.type === 'avoid-section' || c.type === 'prefer-section') && c.params?.sectionId === sectionId)
			.map((c) => c.id);
		if (!ids.length) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	async function removeSectionSoftForSectionIdOfType(sectionId: string, type: SoftConstraint['type']) {
		const ids = softConstraints
			.filter((c) => c.type === type && c.params?.sectionId === sectionId)
			.map((c) => c.id);
		if (!ids.length) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	async function applySectionPreference({
		courseHash,
		sectionId,
		priority,
		direction,
		weight,
		note
	}: {
		courseHash: string;
		sectionId: string;
		priority: DesiredLock['priority'];
		direction: NonNullable<DesiredLock['direction']>;
		weight?: number;
		note?: string;
	}) {
		message = '';

		if (priority === 'soft') {
			const ok1 = await removeSectionLocksForSectionId(sectionId);
			if (!ok1) return;

			const softType: SoftConstraint['type'] = direction === 'avoid' ? 'avoid-section' : 'prefer-section';
			const oppositeType: SoftConstraint['type'] = direction === 'avoid' ? 'prefer-section' : 'avoid-section';
			const finalWeight = Math.max(1, Math.round(weight ?? 10));

			// Keep (at most) one same-type constraint; delete opposite-type constraints.
			const sameType = softConstraints
				.filter((c) => c.type === softType && typeof c.params?.sectionId === 'string' && c.params.sectionId === sectionId)
				.slice()
				.sort((a, b) => a.id.localeCompare(b.id));
			const keep = sameType[0] ?? null;
			if (sameType.length > 1) {
				const removed = await dispatchTermAction({
					type: 'SOLVER_REMOVE_SOFT_MANY',
					ids: sameType.slice(1).map((c) => c.id)
				});
				if (!removed.ok) {
					message = removed.error.message;
					return;
				}
			}

			const ok2 = await removeSectionSoftForSectionIdOfType(sectionId, oppositeType);
			if (!ok2) return;

			if (keep) {
				const result = await dispatchTermAction({
					type: 'SOLVER_UPDATE_SOFT',
					id: keep.id,
					patch: { weight: finalWeight, note: note?.trim() || undefined }
				});
				if (!result.ok) message = result.error.message;
				return;
			}

			const constraint: SoftConstraint = {
				id: createId('soft'),
				type: softType,
				weight: finalWeight,
				params: { sectionId },
				note: note?.trim() || undefined
			};
			const result = await dispatchTermAction({ type: 'SOLVER_ADD_SOFT', constraint });
			if (!result.ok) message = result.error.message;
			return;
		}

		const ok = await removeSectionSoftForSectionId(sectionId);
		if (!ok) return;

		const lockIds = locks.filter((l) => l.type === 'section' && l.sectionId === sectionId).map((l) => l.id);
		const existingLockId = lockIds[0] ?? null;
		if (existingLockId) {
			const result = await dispatchTermAction({
				type: 'SOLVER_UPDATE_LOCK',
				id: existingLockId,
				patch: { courseHash, sectionId, priority: 'hard', direction, note: note?.trim() || undefined }
			});
			if (!result.ok) {
				message = result.error.message;
				return;
			}
			if (lockIds.length > 1) {
				const removed = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK_MANY', ids: lockIds.slice(1) });
				if (!removed.ok) {
					message = removed.error.message;
					return;
				}
			}
			return;
		}

		const lock: DesiredLock = {
			id: createId('lock'),
			type: 'section',
			courseHash,
			sectionId,
			priority: 'hard',
			direction,
			note: note?.trim() || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_LOCK', lock });
		if (!result.ok) message = result.error.message;
	}

	async function removeSoft(id: string) {
		message = '';
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT', id });
		if (!result.ok) message = result.error.message;
	}

	async function clearStaging() {
		message = '';
		const result = await dispatchTermAction({ type: 'SOLVER_STAGING_CLEAR' });
		if (!result.ok) {
			message = result.error.message;
			return;
		}
		resetStagingLocalState();
	}

	async function upsertGroupLock({
		groupKey,
		courseHashes,
		includeSections,
		excludeSections,
		priority,
		direction,
		note
	}: {
		groupKey: string;
		courseHashes: string[];
		includeSections?: string[];
		excludeSections?: string[];
		priority: DesiredLock['priority'];
		direction: NonNullable<DesiredLock['direction']>;
		note?: string;
	}) {
		const signature = courseHashes.slice().sort().join('|');
		const existing = locks.find(
			(lock) =>
				lock.type === 'group' && (lock.group?.courseHashes ?? []).slice().sort().join('|') === signature
		);

		if (existing) {
			const result = await dispatchTermAction({
				type: 'SOLVER_UPDATE_LOCK',
				id: existing.id,
				patch: {
					group: { courseHashes, minSelect: 1, maxSelect: 1 },
					includeSections: includeSections?.length ? includeSections : undefined,
					excludeSections: excludeSections?.length ? excludeSections : undefined,
					priority,
					direction,
					note: note?.trim() || undefined
				}
			});
			if (!result.ok) message = result.error.message;
			return;
		}

		const lock: DesiredLock = {
			id: createId('lock'),
			type: 'group',
			group: { courseHashes, minSelect: 1, maxSelect: 1 },
			includeSections: includeSections?.length ? includeSections : undefined,
			excludeSections: excludeSections?.length ? excludeSections : undefined,
			priority,
			direction,
			note: note?.trim() || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_LOCK', lock });
		if (!result.ok) message = result.error.message;
	}

	async function applyStagingItem(item: { kind: 'group' | 'section'; key: string }) {
		message = '';
		const hard = getStagingHardState(item as any);
		const soft = getStagingSoftState(item as any);
		const weight = getStagingSoftWeight(item as any);
		const hasExplicit = hard !== 'none' || soft !== 'none';
		if (!hasExplicit) {
			message = t('panels.solver.pendingApplyRequiresExplicit');
			return;
		}

		if (item.kind === 'section') {
			const entry = courseCatalogMap.get(item.key);
			if (!entry) {
				message = t('dialogs.solverInvalid.reasons.lock.sectionNotFound');
				return;
			}
			if (hard !== 'none' && soft !== 'none') {
				message = t('panels.solver.pendingConflictHardSoft');
				return;
			}
			if (hard !== 'none') {
				await applySectionPreference({
					courseHash: entry.courseHash,
					sectionId: entry.sectionId,
					priority: 'hard',
					direction: directionFromTriState(hard),
					weight: 10
				});
				if (message) return;
			}
			if (soft !== 'none') {
				await applySectionPreference({
					courseHash: entry.courseHash,
					sectionId: entry.sectionId,
					priority: 'soft',
					direction: directionFromTriState(soft),
					weight
				});
				if (message) return;
			}
			if (!message) {
				const removed = await dispatchTermAction({ type: 'SOLVER_STAGING_REMOVE', item: item as any });
				if (!removed.ok) message = removed.error.message;
				else clearStagingLocalItem(item);
			}
			return;
		}

		const entries = getGroupEntries(item.key);
		const courseHashes = Array.from(new Set(entries.map((e) => e.courseHash))).filter(Boolean).sort();
		if (!courseHashes.length) {
			message = t('panels.solver.groupAllowed.missingGroup');
			return;
		}
		if (hard !== 'none') {
			await upsertGroupLock({
				groupKey: item.key,
				courseHashes,
				priority: 'hard',
				direction: directionFromTriState(hard)
			});
			if (message) return;
		}
		if (soft !== 'none') {
			await upsertGroupSoftPreference({
				groupKey: item.key,
				direction: directionFromTriState(soft),
				weight
			});
			if (message) return;
		}
		if (!message) {
			const removed = await dispatchTermAction({ type: 'SOLVER_STAGING_REMOVE', item: item as any });
			if (!removed.ok) message = removed.error.message;
			else clearStagingLocalItem(item);
		}
	}

	async function ensureStagingItem(item: { kind: 'group' | 'section'; key: string }) {
		const exists = stagingItems.some((candidate) => candidate.kind === item.kind && candidate.key === item.key);
		if (exists) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_STAGING_ADD', item: item as any });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	function seedStagingDefaults(items: Array<{ kind: 'group' | 'section'; key: string }>) {
		let nextHard = stagingHardState;
		let nextSoft = stagingSoftState;
		let nextWeight = stagingSoftWeight;
		let hardChanged = false;
		let softChanged = false;
		let weightChanged = false;

		for (const item of items) {
			const key = stagingKey(item);
			if (item.kind === 'group') {
				if (!nextHard.has(key)) {
					if (!hardChanged) {
						nextHard = new Map(nextHard);
						hardChanged = true;
					}
					nextHard.set(key, activePreferenceSeed.groupHard.get(item.key) ?? 'none');
				}

				if (!nextSoft.has(key)) {
					if (!softChanged) {
						nextSoft = new Map(nextSoft);
						softChanged = true;
					}
					nextSoft.set(key, (activePreferenceSeed.groupSoft.get(item.key) ?? { state: 'none' as const }).state);
				}

				if (!nextWeight.has(key)) {
					if (!weightChanged) {
						nextWeight = new Map(nextWeight);
						weightChanged = true;
					}
					nextWeight.set(key, (activePreferenceSeed.groupSoft.get(item.key) ?? { weight: 10 }).weight);
				}
				continue;
			}

			const entry = courseCatalogMap.get(item.key) ?? null;
			if (!entry) continue;
			const entryId = entry.id;
			const hardSeed = activePreferenceSeed.sectionHard.get(entryId) ?? 'none';
			const softSeed = activePreferenceSeed.sectionSoft.get(entryId) ?? { state: 'none' as const, weight: 10 };

			if (!nextHard.has(key)) {
				if (!hardChanged) {
					nextHard = new Map(nextHard);
					hardChanged = true;
				}
				nextHard.set(key, hardSeed);
			}
			if (!nextSoft.has(key)) {
				if (!softChanged) {
					nextSoft = new Map(nextSoft);
					softChanged = true;
				}
				nextSoft.set(key, softSeed.state);
			}
			if (!nextWeight.has(key)) {
				if (!weightChanged) {
					nextWeight = new Map(nextWeight);
					weightChanged = true;
				}
				nextWeight.set(key, softSeed.weight);
			}
		}

		if (hardChanged) stagingHardState = nextHard;
		if (softChanged) stagingSoftState = nextSoft;
		if (weightChanged) stagingSoftWeight = nextWeight;
	}

	async function setPendingState(item: { kind: 'group' | 'section'; key: string }, level: 'hard' | 'soft', next: TriState) {
		message = '';
		const ok = await ensureStagingItem(item);
		if (!ok) return;
		seedStagingDefaults([item]);
		if (level === 'hard') {
			setStagingHardState(item as any, next);
			if (item.kind === 'section' && next !== 'none') setStagingSoftState(item as any, 'none');
			return;
		}
		setStagingSoftState(item as any, next);
		if (item.kind === 'section' && next !== 'none') setStagingHardState(item as any, 'none');
	}

	async function removeGroupHardLocksForGroupKey(groupKey: string) {
		const ids = locks
			.filter((lock) => lock.type === 'group' && lock.priority === 'hard' && groupKeyFromGroupLock(lock) === groupKey)
			.map((lock) => lock.id);
		if (!ids.length) return true;
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK_MANY', ids });
		if (!result.ok) {
			message = result.error.message;
			return false;
		}
		return true;
	}

	async function applyGroupAllowOnly(groupKey: string) {
		message = '';
		const state = ensureGroupInline(groupKey);
		const entries = getGroupEntries(groupKey);
		const allSectionIds = Array.from(new Set(entries.map((e) => e.sectionId).filter(Boolean))).sort();
		const allowed = allSectionIds.filter((id) => state.allowed.has(id));
		if (!allowed.length) {
			message = t('panels.solver.groupAllowed.emptyError');
			return;
		}
		const excluded = allSectionIds.filter((id) => !state.allowed.has(id));
		const courseHashes = Array.from(new Set(entries.map((e) => e.courseHash))).filter(Boolean).sort();
		await upsertGroupLock({
			groupKey,
			courseHashes,
			includeSections: allowed,
			excludeSections: excluded,
			priority: 'hard',
			direction: 'desire'
		});
	}

	async function applyGroupSectionPreferences(groupKey: string, direction: NonNullable<DesiredLock['direction']>) {
		message = '';
		const state = ensureGroupInline(groupKey);
		const entries = getGroupEntries(groupKey);
		const courseHashes = Array.from(new Set(entries.map((e) => e.courseHash))).filter(Boolean).sort();
		if (courseHashes.length) {
			await upsertGroupLock({ groupKey, courseHashes, priority: 'hard', direction: 'desire' });
			if (message) return;
		}

		const allSectionIds = Array.from(new Set(entries.map((e) => e.sectionId).filter(Boolean))).sort();
		const targets = state.selected.size ? allSectionIds.filter((id) => state.selected.has(id)) : allSectionIds;
		for (const sectionId of targets) {
			const entry = entries.find((e) => e.sectionId === sectionId);
			if (!entry) continue;
			await applySectionPreference({
				courseHash: entry.courseHash,
				sectionId,
				priority: state.priority,
				direction,
				weight: state.weight
			});
			if (message) return;
		}
		state.selected.clear();
		setGroupInline(groupKey, { selected: new Set() });
	}

	async function convertSectionStagingToGroup(entryId: string) {
		const entry = courseCatalogMap.get(entryId);
		if (!entry) return;
		const groupKey = deriveGroupKey(entry) as unknown as string;

		// Preserve current staging choices (section -> group).
		const sectionStagingKey = `section:${entryId}`;
		const groupStagingKey = `group:${groupKey}`;
		const hard = stagingHardState.get(sectionStagingKey);
		const soft = stagingSoftState.get(sectionStagingKey);
		const weight = stagingSoftWeight.get(sectionStagingKey);
		if (hard) {
			stagingHardState = new Map(stagingHardState);
			stagingHardState.set(groupStagingKey, hard);
		}
		if (soft) {
			stagingSoftState = new Map(stagingSoftState);
			stagingSoftState.set(groupStagingKey, soft);
		}
		if (typeof weight === 'number' && Number.isFinite(weight)) {
			stagingSoftWeight = new Map(stagingSoftWeight);
			stagingSoftWeight.set(groupStagingKey, weight);
		}

		await dispatchTermAction({ type: 'SOLVER_STAGING_ADD', item: { kind: 'group', key: groupKey } as any });
		await dispatchTermAction({ type: 'SOLVER_STAGING_REMOVE', item: { kind: 'section', key: entryId } as any });

		const inline = ensureGroupInline(groupKey);
		setGroupInline(groupKey, {
			mode: 'preferences',
			priority: inline.priority,
			weight: typeof weight === 'number' && Number.isFinite(weight) ? Math.max(1, Math.round(weight)) : inline.weight
		});

		toggleGroupExpanded(groupKey);
	}

	async function runSolver() {
		if (solving) return;
		message = '';
		try {
			solving = true;
			const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'SOLVER_RUN', runType: 'manual' });
			const dispatched = await result;
			if (!dispatched.ok) {
				if (dispatched.error.kind !== 'DIALOG_REQUIRED') {
					message = dispatched.error.message;
				}
				return;
			}
			await effectsDone;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			solving = false;
		}
	}

	async function applyLatestResult() {
		if (!latestResult || latestResult.status !== 'sat') return;
		if (actionBusy) return;
		message = '';
		try {
			actionBusy = true;
			const result = await dispatchTermAction({
				type: 'SOLVER_APPLY_RESULT',
				resultId: latestResult.id,
				mode: applyMode
			});
			if (!result.ok) message = result.error.message;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			actionBusy = false;
		}
	}

	async function undoApplyLatest() {
		if (actionBusy) return;
		message = '';
		try {
			actionBusy = true;
			const result = await dispatchTermAction({ type: 'SOLVER_UNDO_LAST_APPLY' });
			if (!result.ok) message = result.error.message;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			actionBusy = false;
		}
	}

	function closeInvalidDialog() {
		clearTermStateAlert();
	}

	async function deleteInvalidConstraints() {
		const lockIds = new Set<string>();
		const softIds = new Set<string>();
		for (const issue of invalidIssues) {
			if (issue.domain === 'lock') lockIds.add(issue.id);
			if (issue.domain === 'soft') softIds.add(issue.id);
		}
		if (lockIds.size) await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK_MANY', ids: Array.from(lockIds) });
		if (softIds.size) await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT_MANY', ids: Array.from(softIds) });
		clearTermStateAlert();
	}

	function describeIssue(issue: (typeof invalidIssues)[number]) {
		const reason = t(`dialogs.solverInvalid.reasons.${issue.code}`);
		const label =
			issue.domain === 'lock'
				? t('dialogs.solverInvalid.lockLabel', { id: issue.id })
				: t('dialogs.solverInvalid.softLabel', { id: issue.id });
		return `${label} · ${reason}`;
	}

		function describeSoft(constraint: SoftConstraint) {
			const note = constraint.note?.trim() ?? '';
			const withNote = (value: string) => (note ? `${value} · ${note}` : value);

			const label = t(`panels.solver.softTypeOptions.${constraint.type}`);
			if (constraint.type === 'avoid-section') {
				const sectionId = typeof constraint.params?.sectionId === 'string' ? constraint.params.sectionId : '';
				const entry = sectionId ? courseCatalog.find((item) => item.sectionId === sectionId) ?? null : null;
				const hint = entry
					? `${entry.title} · ${entry.slot ?? t('courseCard.noTime')}`
					: sectionId || '-';
				return withNote(t('panels.solver.softDescriptions.avoid-section', { label: hint }));
			}
			if (constraint.type === 'avoid-group') {
				const groupKey = typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : '';
				const entries = groupKey ? getGroupEntries(groupKey) : [];
				const hint = entries.length
					? `${entries[0]?.title ?? groupKey} · ${t('panels.allCourses.variantCountLabel', { count: entries.length })}`
					: groupKey || '-';
				return withNote(t('panels.solver.softDescriptions.avoid-group', { label: hint }));
			}
			if (constraint.type === 'prefer-section') {
				const sectionId = typeof constraint.params?.sectionId === 'string' ? constraint.params.sectionId : '';
				const entry = sectionId ? courseCatalog.find((item) => item.sectionId === sectionId) ?? null : null;
				const hint = entry
					? `${entry.title} · ${entry.slot ?? t('courseCard.noTime')}`
					: sectionId || '-';
				return withNote(t('panels.solver.softDescriptions.prefer-section', { label: hint }));
			}
			if (constraint.type === 'prefer-group') {
				const groupKey = typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : '';
				const entries = groupKey ? getGroupEntries(groupKey) : [];
				const hint = entries.length
					? `${entries[0]?.title ?? groupKey} · ${t('panels.allCourses.variantCountLabel', { count: entries.length })}`
					: groupKey || '-';
				return withNote(t('panels.solver.softDescriptions.prefer-group', { label: hint }));
			}
			if (constraint.type === 'avoid-campus') {
				const campus = typeof constraint.params?.campus === 'string' ? constraint.params.campus : '';
				return withNote(t('panels.solver.softDescriptions.avoid-campus', { campus: campus || '-' }));
			}
			return withNote(label);
		}

	function describeLock(lock: DesiredLock) {
		const note = lock.note?.trim() ?? '';
		const withNote = (value: string) => (note ? `${value} · ${note}` : value);

		if (lock.type === 'time' && lock.timeWindow) {
			const day = Math.max(0, Math.min(6, Math.floor(lock.timeWindow.day)));
			const start = Math.max(1, Math.floor(lock.timeWindow.startPeriod));
			const end = Math.max(1, Math.floor(lock.timeWindow.endPeriod));
			const weekday = t(`calendar.weekdaysShort[${day}]`);
			const range = `${start}-${end}`;
			return withNote(t('panels.solver.lockTimeLabel', { weekday, range }));
		}
		if (lock.type === 'teacher') {
			const teacherId = (lock.teacherId ?? '').trim();
			if (!teacherId) return withNote(t('panels.solver.lockTeacherLabel'));
			const resolvedName = teacherIndex.byId.get(teacherId)?.name?.trim() ?? '';
			const label = resolvedName ? `${resolvedName} · ${teacherId}` : teacherId;
			return withNote(`${t('panels.solver.lockTeacherLabel')}: ${label}`);
		}
		if (lock.type === 'section') {
			const courseHash = lock.courseHash ?? '';
			const sectionId = lock.sectionId ?? '';
			const entryId = courseHash && sectionId ? `${courseHash}:${sectionId}` : '';
			const entry =
				(entryId ? courseCatalogMap.get(entryId) ?? null : null) ??
				(sectionId ? courseCatalog.find((item) => item.sectionId === sectionId) ?? null : null);
			if (entry) return withNote(`${entry.title} · ${entry.slot ?? t('courseCard.noTime')}`);
			return withNote(
				sectionId ? t('panels.solver.lockSectionLabel', { id: sectionId }) : t(`panels.solver.lockTypeOptions.${lock.type}`)
			);
		}
		if (lock.type === 'group') {
			const courseHashes = (lock.group?.courseHashes ?? []).filter(Boolean);
			const uniqueCourseHashes = Array.from(new Set(courseHashes));
			const count = uniqueCourseHashes.length;
			const includeCount = lock.includeSections?.length ?? 0;
			const excludeCount = lock.excludeSections?.length ?? 0;

			const parts = [t('panels.solver.lockGroupLabel', { count })];
			if (includeCount) parts.push(t('panels.solver.groupAllowed.count', { count: includeCount }));
			if (excludeCount) parts.push(t('panels.solver.groupAllowed.avoidCount', { count: excludeCount }));

			const titles = uniqueCourseHashes
				.map((courseHash) => courseCatalog.find((entry) => entry.courseHash === courseHash)?.title ?? '')
				.map((value) => value.trim())
				.filter(Boolean);
			const uniqueTitles = Array.from(new Set(titles));
			if (uniqueTitles.length) parts.push(uniqueTitles.slice(0, 3).join(' / ') + (uniqueTitles.length > 3 ? '…' : ''));

			return withNote(parts.join(' · '));
		}
		if (lock.type === 'course') {
			const courseHash = lock.courseHash ?? '';
			const entry = courseHash ? courseCatalog.find((item) => item.courseHash === courseHash) ?? null : null;
			const label = entry ? entry.title : t(`panels.solver.lockTypeOptions.${lock.type}`);
			return withNote(label);
		}
		return withNote(t(`panels.solver.lockTypeOptions.${lock.type}`));
	}

	function lockCardTitle(lock: DesiredLock) {
		if (lock.type === 'section') {
			const courseHash = lock.courseHash ?? '';
			const sectionId = lock.sectionId ?? '';
			const entryId = courseHash && sectionId ? `${courseHash}:${sectionId}` : '';
			const entry = entryId ? courseCatalogMap.get(entryId) ?? null : null;
			return entry?.title ?? t(`panels.solver.lockTypeOptions.${lock.type}`);
		}
		if (lock.type === 'course') {
			const courseHash = lock.courseHash ?? '';
			const entry = courseHash ? courseCatalog.find((item) => item.courseHash === courseHash) ?? null : null;
			return entry?.title ?? t(`panels.solver.lockTypeOptions.${lock.type}`);
		}
		if (lock.type === 'group') {
			const courseHashes = (lock.group?.courseHashes ?? []).filter(Boolean);
			const uniqueCourseHashes = Array.from(new Set(courseHashes));
			const titles = uniqueCourseHashes
				.map((courseHash) => courseCatalog.find((entry) => entry.courseHash === courseHash)?.title ?? '')
				.map((value) => value.trim())
				.filter(Boolean);
			const uniqueTitles = Array.from(new Set(titles));
			if (uniqueTitles.length === 1) return uniqueTitles[0] ?? t(`panels.solver.lockTypeOptions.${lock.type}`);
			if (uniqueTitles.length > 1) return `${uniqueTitles[0]} +${uniqueTitles.length - 1}`;
			return t(`panels.solver.lockTypeOptions.${lock.type}`);
		}
		return t(`panels.solver.lockTypeOptions.${lock.type}`);
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.solver.title')}
		subtitle={t('panels.solver.description')}
		density="comfortable"
	>
			<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.intro')}</p>
			{#if $crossCampusAllowed}
				<div class="mt-3 flex flex-wrap gap-3">
					<AppField label={t('settings.homeCampusLabel')} description={t('settings.homeCampusDesc')} class="flex-1 min-w-[min(260px,100%)] w-auto">
						<select
							class={inputInlineClass}
							value={$homeCampus}
							on:change={(e) => setHomeCampus((e.currentTarget as HTMLSelectElement).value)}
						>
							{#each filterOptions.campuses as campus (campus)}
								<option value={campus}>{campus}</option>
							{/each}
						</select>
					</AppField>
				</div>
			{/if}

				{#if message}
					<p class="mt-3 mb-0 rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg))] px-4 py-3 text-[var(--app-text-sm)] text-[var(--app-color-danger)]">
						{message}
				</p>
			{/if}

			{#if invalidDialogOpen}
				<div class="mt-3 rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-color-warn)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-color-warn)_12%,var(--app-color-bg))] px-4 py-3 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex flex-col gap-1 min-w-[min(320px,100%)]">
							<div class="font-medium">{t('dialogs.solverInvalid.title')}</div>
							<div class="text-[var(--app-color-fg-muted)]">
								{t('dialogs.solverInvalid.summary', { count: invalidIssues.length })}
							</div>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<AppButton variant="secondary" size="sm" on:click={closeInvalidDialog}>
								{t('dialogs.solverInvalid.close')}
							</AppButton>
							<AppButton variant="danger" size="sm" on:click={deleteInvalidConstraints} disabled={!invalidIssues.length}>
								{t('dialogs.solverInvalid.autoDelete')}
							</AppButton>
						</div>
					</div>
					{#if invalidIssues.length}
						<ul class="mt-2 mb-0 flex flex-col gap-1 pl-5">
							{#each invalidIssues as issue (issue.domain + issue.id + issue.code)}
								<li class="break-words [overflow-wrap:anywhere]">{describeIssue(issue)}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			{#if !$termState}
				<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintsNotReady')}</p>
			{:else}
			<div class="mt-4 flex flex-wrap items-start gap-5 min-w-0">
				<AppControlPanel
					title={t('panels.solver.pendingTitle')}
					description={t('panels.solver.pendingHint')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					<SolverMinBatchControl state={$termState} scope="current" selectClass={inputInlineClass} />
					<div class="flex flex-col gap-3">
						{#if stagingItems.length === 0}
							<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.pendingEmpty')}
							</p>
						{:else}
							<div class="flex flex-col gap-3">
									{#each stagingItems as item (item.kind + ':' + item.key)}
										{#if item.kind === 'group'}
											{@const entries = getGroupEntries(item.key)}
											{@const primary = entries[0] ?? null}
											{@const title = primary?.title ?? item.key}
											{@const subtitle = `${primary?.courseCode ?? ''} · ${t('panels.allCourses.variantCountLabel', { count: entries.length })}`.trim()}
											{@const itemKey = stagingKey(item)}
											{@const hard = stagingHardState.get(itemKey) ?? 'none'}
											{@const soft = stagingSoftState.get(itemKey) ?? 'none'}
											{@const softWeight = stagingSoftWeight.get(itemKey) ?? 10}
											{@const canApply = hard !== 'none' || soft !== 'none'}
											<SolverListCard density="dense" title={title} subtitle={subtitle} colorSeed={item.key}>
												<svelte:fragment slot="actions">
													<div class="flex flex-wrap items-start justify-end gap-2">
														<ConstraintStatusBox
															showTag
															variant="pending"
															hard={hard}
															soft={soft}
															onChange={(level, next) => void setPendingState(item as any, level, next)}
														/>
														{#if soft !== 'none'}
															<input
																class={inputInlineClass}
																type="number"
																min="1"
																size="4"
																value={softWeight}
																on:change={(e) =>
																	setStagingSoftWeight(item as any, Number((e.currentTarget as HTMLInputElement).value))}
																aria-label={t('panels.solver.cardOps.weightLabel')}
															/>
														{/if}
													<div class="flex flex-wrap justify-end gap-2">
														<AppButton
															variant="secondary"
															size="sm"
															disabled={!canApply}
															on:click={() => applyStagingItem(item as any)}
														>
															{t('panels.solver.cardOps.applyToGroup')}
														</AppButton>
													</div>
												</div>
											</svelte:fragment>
										</SolverListCard>
										{:else}
											{@const entry = courseCatalogMap.get(item.key) ?? null}
											{#if entry}
												{@const itemKey = stagingKey(item)}
												{@const hard = stagingHardState.get(itemKey) ?? 'none'}
												{@const soft = stagingSoftState.get(itemKey) ?? 'none'}
												{@const softWeight = stagingSoftWeight.get(itemKey) ?? 10}
												{@const canApply = hard !== 'none' || soft !== 'none'}
												<CourseCard
													id={entry.id}
													density="dense"
													title={entry.title}
												teacher={entry.teacher ?? null}
												time={entry.slot ?? t('courseCard.noTime')}
												courseCode={entry.courseCode}
												credit={entry.credit ?? null}
												status={entry.status}
												capacity={entry.capacity}
												vacancy={entry.vacancy}
												colorSeed={entry.id}
												hoverable={false}
												onHover={undefined}
												onLeave={undefined}
												>
													<CardActionBar slot="actions" class="justify-end">
														<ConstraintStatusBox
															showTag
															variant="pending"
															hard={hard}
															soft={soft}
															onChange={(level, next) => void setPendingState(item as any, level, next)}
														/>
														{#if soft !== 'none'}
															<input
																class={inputInlineClass}
																type="number"
																min="1"
																size="4"
																value={softWeight}
																on:change={(e) =>
																	setStagingSoftWeight(item as any, Number((e.currentTarget as HTMLInputElement).value))}
																aria-label={t('panels.solver.cardOps.weightLabel')}
															/>
														{/if}
													<div class="flex flex-wrap justify-end gap-2">
														<AppButton
															variant="secondary"
															size="sm"
															disabled={!canApply}
															on:click={() => applyStagingItem(item as any)}
														>
															{t('panels.solver.cardOps.applyToSection')}
														</AppButton>
													</div>
												</CardActionBar>
											</CourseCard>
										{/if}
									{/if}
								{/each}
							</div>
						{/if}

						<div class="flex justify-end">
							<AppButton variant="secondary" size="sm" on:click={clearStaging} disabled={stagingItems.length === 0}>
								{t('panels.solver.stagingClear')}
							</AppButton>
						</div>

						<div class="mt-4 flex flex-wrap items-center justify-between gap-2">
							<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.quickAddTitle')}
							</p>
							<div class="flex flex-wrap items-center gap-2">
								<AppButton
									variant={quickAddOpen === 'time' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'time' ? null : 'time')}
								>
									{t('panels.solver.quickAdd.time')}
								</AppButton>
								<AppButton
									variant={quickAddOpen === 'teacher' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'teacher' ? null : 'teacher')}
								>
									{t('panels.solver.quickAdd.teacher')}
								</AppButton>
								<AppButton
									variant={quickAddOpen === 'soft' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'soft' ? null : 'soft')}
								>
									{t('panels.solver.quickAdd.soft')}
								</AppButton>
							</div>
						</div>

						{#if quickAddOpen === 'time'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.direction')}>
										<select class={inputClass} bind:value={timeDirection}>
											<option value="desire">{t('dropdowns.desire')}</option>
											<option value="avoid">{t('dropdowns.avoid')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.priority')}>
										<select class={inputClass} bind:value={timePriority}>
											<option value="hard">{t('dropdowns.hard')}</option>
											<option value="soft">{t('dropdowns.soft')}</option>
										</select>
									</AppField>
								</AppControlRow>

								<div class="flex flex-col gap-2">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.lockWeekday')}</div>
										<AppButton
											variant="secondary"
											size="sm"
											on:click={() => (timeDays = new Set([0, 1, 2, 3, 4, 5, 6]))}
										>
											{t('panels.solver.timeDialog.applyAllDays')}
										</AppButton>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each [0, 1, 2, 3, 4, 5, 6] as day (day)}
											<label class="flex items-center gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
												<input
													type="checkbox"
													checked={timeDays.has(day)}
													on:change={() => {
														const next = new Set(timeDays);
														if (next.has(day)) next.delete(day);
														else next.add(day);
														timeDays = next;
													}}
													aria-label={t(`calendar.weekdaysShort[${day}]`)}
												/>
												{t(`calendar.weekdaysShort[${day}]`)}
											</label>
										{/each}
									</div>
								</div>

								<AppControlRow>
									<AppField label={t('panels.solver.lockStartPeriod')}>
										<input class={inputClass} type="number" min="1" bind:value={timeStartPeriod} />
									</AppField>
									<AppField label={t('panels.solver.lockEndPeriod')}>
										<input class={inputClass} type="number" min="1" bind:value={timeEndPeriod} />
									</AppField>
								</AppControlRow>

								<AppField label={t('panels.solver.lockNote')}>
									<input class={inputClass} type="text" bind:value={timeNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addTimeLock();
											if (!message) quickAddOpen = null;
										}}
										disabled={!timeDays.size}
									>
										{t('panels.solver.addLock')}
									</AppButton>
								</div>
							</div>
						{:else if quickAddOpen === 'teacher'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.direction')}>
										<select class={inputClass} bind:value={teacherDirection}>
											<option value="desire">{t('dropdowns.desire')}</option>
											<option value="avoid">{t('dropdowns.avoid')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.priority')}>
										<select class={inputClass} bind:value={teacherPriority}>
											<option value="hard">{t('dropdowns.hard')}</option>
											<option value="soft">{t('dropdowns.soft')}</option>
										</select>
									</AppField>
								</AppControlRow>

								<AppField label={t('panels.solver.lockTeacher')}>
									<div class="flex flex-col gap-2">
										<input
											class={inputClass}
											type="text"
											bind:value={teacherQuery}
											placeholder={t('panels.solver.teacherPlaceholder')}
											on:input={() => {
												teacherSelectedId = null;
												teacherSuggestionsFocusedIndex = null;
											}}
										/>
										{#if teacherSuggestions.length}
											<div class="flex flex-col gap-1">
												{#each teacherSuggestions as candidate, index (candidate.teacherId)}
													<button
														type="button"
														class={`flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-left text-[var(--app-text-xs)] ${
															teacherSuggestionsFocusedIndex === index
																? 'bg-[color-mix(in_srgb,var(--app-color-primary)_12%,var(--app-color-bg))]'
																: 'hover:bg-[color-mix(in_srgb,var(--app-color-bg)_70%,var(--app-color-bg-elevated)_30%)]'
														}`}
														on:click={() => {
															teacherSelectedId = candidate.teacherId;
															teacherQuery = teacherCandidateLabel(candidate);
														}}
													>
														<span class="min-w-0 flex-1 truncate">{candidate.name || candidate.teacherId}</span>
														<span class="shrink-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															{candidate.teacherId}
														</span>
													</button>
												{/each}
											</div>
										{/if}
										{#if resolvedTeacherId}
											<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{t('panels.solver.teacherResolved', { label: resolvedTeacherLabel })}
											</div>
										{/if}
									</div>
								</AppField>

								<AppField label={t('panels.solver.lockNote')}>
									<input class={inputClass} type="text" bind:value={teacherNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addTeacherLock();
											if (!message) quickAddOpen = null;
										}}
										disabled={!resolvedTeacherId}
									>
										{t('panels.solver.addLock')}
									</AppButton>
								</div>
							</div>
						{:else if quickAddOpen === 'soft'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.quickType')}>
										<select class={inputClass} bind:value={softType}>
											<option value="avoid-early">{t('panels.solver.softTypeOptions.avoid-early')}</option>
											<option value="avoid-late">{t('panels.solver.softTypeOptions.avoid-late')}</option>
											<option value="avoid-campus">{t('panels.solver.softTypeOptions.avoid-campus')}</option>
											<option value="limit-consecutive">{t('panels.solver.softTypeOptions.limit-consecutive')}</option>
											<option value="max-per-day">{t('panels.solver.softTypeOptions.max-per-day')}</option>
											<option value="custom">{t('panels.solver.softTypeOptions.custom')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.quickWeight')}>
										<input class={inputClass} type="number" min="1" bind:value={softWeight} />
									</AppField>
								</AppControlRow>

								{#if softType === 'avoid-campus'}
									<AppField label={t('panels.solver.softCampusLabel')}>
										<select class={inputClass} bind:value={softCampus}>
											{#each filterOptions.campuses as campus (campus)}
												<option value={campus}>{campus}</option>
											{/each}
										</select>
									</AppField>
								{/if}

								<AppField label={t('panels.solver.quickNote')}>
									<input class={inputClass} type="text" bind:value={softNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addSoftConstraint();
											if (!message) quickAddOpen = null;
										}}
									>
										{t('panels.solver.addSoft')}
									</AppButton>
								</div>
							</div>
						{/if}
					</div>
				</AppControlPanel>

				{#if false}
						<div class="mt-4 flex flex-wrap items-center justify-between gap-2">
							<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.quickAddTitle')}
							</p>
							<div class="flex flex-wrap items-center gap-2">
								<AppButton
									variant={quickAddOpen === 'time' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'time' ? null : 'time')}
								>
									{t('panels.solver.quickAdd.time')}
								</AppButton>
								<AppButton
									variant={quickAddOpen === 'teacher' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'teacher' ? null : 'teacher')}
								>
									{t('panels.solver.quickAdd.teacher')}
								</AppButton>
								<AppButton
									variant={quickAddOpen === 'soft' ? 'primary' : 'secondary'}
									size="sm"
									on:click={() => (quickAddOpen = quickAddOpen === 'soft' ? null : 'soft')}
								>
									{t('panels.solver.quickAdd.soft')}
								</AppButton>
							</div>
						</div>

						{#if quickAddOpen === 'time'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.direction')}>
										<select class={inputClass} bind:value={timeDirection}>
											<option value="desire">{t('dropdowns.desire')}</option>
											<option value="avoid">{t('dropdowns.avoid')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.priority')}>
										<select class={inputClass} bind:value={timePriority}>
											<option value="hard">{t('dropdowns.hard')}</option>
											<option value="soft">{t('dropdowns.soft')}</option>
										</select>
									</AppField>
								</AppControlRow>

								<div class="flex flex-col gap-2">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.lockWeekday')}</div>
										<AppButton
											variant="secondary"
											size="sm"
											on:click={() => (timeDays = new Set([0, 1, 2, 3, 4, 5, 6]))}
										>
											{t('panels.solver.timeDialog.applyAllDays')}
										</AppButton>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each [0, 1, 2, 3, 4, 5, 6] as day (day)}
											<label class="flex items-center gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
												<input
													type="checkbox"
													checked={timeDays.has(day)}
													on:change={() => {
														const next = new Set(timeDays);
														if (next.has(day)) next.delete(day);
														else next.add(day);
														timeDays = next;
													}}
													aria-label={t(`calendar.weekdaysShort[${day}]`)}
												/>
												{t(`calendar.weekdaysShort[${day}]`)}
											</label>
										{/each}
									</div>
								</div>

								<AppControlRow>
									<AppField label={t('panels.solver.lockStartPeriod')}>
										<input class={inputClass} type="number" min="1" bind:value={timeStartPeriod} />
									</AppField>
									<AppField label={t('panels.solver.lockEndPeriod')}>
										<input class={inputClass} type="number" min="1" bind:value={timeEndPeriod} />
									</AppField>
								</AppControlRow>

								<AppField label={t('panels.solver.lockNote')}>
									<input class={inputClass} type="text" bind:value={timeNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addTimeLock();
											if (!message) quickAddOpen = null;
										}}
										disabled={!timeDays.size}
									>
										{t('panels.solver.addLock')}
									</AppButton>
								</div>
							</div>
						{:else if quickAddOpen === 'teacher'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.direction')}>
										<select class={inputClass} bind:value={teacherDirection}>
											<option value="desire">{t('dropdowns.desire')}</option>
											<option value="avoid">{t('dropdowns.avoid')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.priority')}>
										<select class={inputClass} bind:value={teacherPriority}>
											<option value="hard">{t('dropdowns.hard')}</option>
											<option value="soft">{t('dropdowns.soft')}</option>
										</select>
									</AppField>
								</AppControlRow>

								<AppField label={t('panels.solver.lockTeacherLabel')}>
									<div class="flex flex-col gap-2">
										<input
											class={inputClass}
											type="text"
											bind:value={teacherQuery}
											placeholder={t('panels.solver.lockTeacherPlaceholder')}
											autocomplete="off"
											on:input={() => {
												teacherSelectedId = null;
												teacherSuggestionsFocusedIndex = null;
											}}
											on:keydown={(event) => {
												if (!teacherSuggestions.length) return;
												if (event.key === 'ArrowDown') {
													event.preventDefault();
													const next =
														teacherSuggestionsFocusedIndex == null
															? 0
															: Math.min(teacherSuggestions.length - 1, teacherSuggestionsFocusedIndex + 1);
													teacherSuggestionsFocusedIndex = next;
												} else if (event.key === 'ArrowUp') {
													event.preventDefault();
													const next =
														teacherSuggestionsFocusedIndex == null
															? teacherSuggestions.length - 1
															: Math.max(0, teacherSuggestionsFocusedIndex - 1);
													teacherSuggestionsFocusedIndex = next;
												} else if (event.key === 'Enter') {
													if (teacherSuggestionsFocusedIndex == null) return;
													event.preventDefault();
													const selected = teacherSuggestions[teacherSuggestionsFocusedIndex];
													if (!selected) return;
													teacherSelectedId = selected.teacherId;
													teacherQuery = selected.name.trim() || selected.teacherId;
													teacherSuggestionsFocusedIndex = null;
												}
											}}
										/>
										{#if teacherSuggestions.length}
											<div
												class="flex flex-col overflow-hidden rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)]"
												role="listbox"
												aria-label={t('panels.solver.lockTeacherPlaceholder')}
											>
												{#each teacherSuggestions as candidate, index (candidate.teacherId)}
													<button
														type="button"
														class={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[var(--app-text-sm)] hover:bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_85%,var(--app-color-primary)_15%)] ${teacherSuggestionsFocusedIndex === index ? 'bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_80%,var(--app-color-primary)_20%)]' : ''}`}
														on:click={() => {
															teacherSelectedId = candidate.teacherId;
															teacherQuery = candidate.name.trim() || candidate.teacherId;
															teacherSuggestionsFocusedIndex = null;
														}}
													>
														<span class="truncate">{candidate.name.trim() || candidate.teacherId}</span>
														<span class="shrink-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															{candidate.teacherId}
														</span>
													</button>
												{/each}
											</div>
										{/if}
										{#if resolvedTeacherId}
											<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{t('panels.solver.teacherResolved', { label: resolvedTeacherLabel })}
											</div>
										{/if}
									</div>
								</AppField>
								<AppField label={t('panels.solver.lockNote')}>
									<input class={inputClass} type="text" bind:value={teacherNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addTeacherLock();
											if (!message) quickAddOpen = null;
										}}
										disabled={!resolvedTeacherId}
									>
										{t('panels.solver.addLock')}
									</AppButton>
								</div>
							</div>
						{:else if quickAddOpen === 'soft'}
							<div class="mt-3 flex flex-col gap-3 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-3">
								<AppControlRow>
									<AppField label={t('panels.solver.quickType')}>
										<select class={inputClass} bind:value={softType}>
											<option value="avoid-early">{t('panels.solver.softTypeOptions.avoid-early')}</option>
											<option value="avoid-late">{t('panels.solver.softTypeOptions.avoid-late')}</option>
											<option value="avoid-campus">{t('panels.solver.softTypeOptions.avoid-campus')}</option>
											<option value="limit-consecutive">{t('panels.solver.softTypeOptions.limit-consecutive')}</option>
											<option value="max-per-day">{t('panels.solver.softTypeOptions.max-per-day')}</option>
											<option value="custom">{t('panels.solver.softTypeOptions.custom')}</option>
										</select>
									</AppField>
									<AppField label={t('panels.solver.quickWeight')}>
										<input class={inputClass} type="number" min="1" bind:value={softWeight} />
									</AppField>
								</AppControlRow>

								{#if softType === 'avoid-campus'}
									<AppField label={t('panels.solver.softCampusLabel')}>
										<select class={inputClass} bind:value={softCampus}>
											{#each filterOptions.campuses as campus (campus)}
												<option value={campus}>{campus}</option>
											{/each}
										</select>
									</AppField>
								{/if}

								<AppField label={t('panels.solver.quickNote')}>
									<input class={inputClass} type="text" bind:value={softNote} />
								</AppField>

								<div class="flex flex-wrap justify-end gap-2">
									<AppButton variant="secondary" size="sm" on:click={() => (quickAddOpen = null)}>
										{t('panels.solver.cancel')}
									</AppButton>
									<AppButton
										variant="primary"
										size="sm"
										on:click={async () => {
											await addSoftConstraint();
											if (!message) quickAddOpen = null;
										}}
									>
										{t('panels.solver.addSoft')}
									</AppButton>
								</div>
							</div>
							{/if}
				{/if}

					<AppControlPanel
						title={t('panels.solver.hardLocks')}
						description={t('panels.solver.description')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					<SolverMinBatchControl state={$termState} scope="current" selectClass={inputDenseInlineClass} />
					{#if selectedHardLockIds.size > 0}
						<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1.5">
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.bulk.selected', { count: selectedHardLockIds.size })}
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<label class="inline-flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									<span>{t('panels.solver.direction')}</span>
									<select class={inputDenseInlineClass} bind:value={bulkLockDirection} aria-label={t('panels.solver.direction')}>
										<option value="desire">{t('dropdowns.desire')}</option>
										<option value="avoid">{t('dropdowns.avoid')}</option>
									</select>
								</label>
								<label class="inline-flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									<span>{t('panels.solver.priority')}</span>
									<select class={inputDenseInlineClass} bind:value={bulkLockPriority} aria-label={t('panels.solver.priority')}>
										<option value="hard">{t('dropdowns.hard')}</option>
										<option value="soft">{t('dropdowns.soft')}</option>
									</select>
								</label>
								<AppButton variant="secondary" size="sm" on:click={() => applyBulkLockPatch(selectedHardLockIds)}>
									{t('panels.solver.bulk.apply')}
								</AppButton>
								<AppButton variant="danger" size="sm" on:click={() => removeSelectedLocks(selectedHardLockIds)}>
									{t('panels.solver.bulk.remove')}
								</AppButton>
								<AppButton variant="secondary" size="sm" on:click={() => clearSelectedLocks(selectedHardLockIds)}>
									{t('panels.solver.bulk.clear')}
								</AppButton>
							</div>
						</div>
					{/if}
					{#if visibleHardLocks.length === 0}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintEmpty')}</p>
						{:else}
							<div class="flex flex-col gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
								{#each visibleHardLocks as lock (lock.id)}
									{@const lockDirection = lock.direction ?? (lock.type === 'time' ? 'avoid' : 'desire')}
									<SolverListCard
										density="dense"
										title={lockCardTitle(lock)}
										subtitle={describeLock(lock)}
										colorSeed={lock.type === 'group' ? (lock.group?.courseHashes?.[0] ?? lock.id) : (lock.courseHash ?? lock.id)}
									>
										<svelte:fragment slot="leading">
											<CardBulkCheckbox
												checked={selectedLockIds.has(lock.id)}
												ariaLabel={lock.id}
												on:toggle={() => toggleSelectedLock(lock.id)}
											/>
										</svelte:fragment>

										<svelte:fragment slot="meta">
											<span class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-0.5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
												{t(`panels.solver.lockTypeOptions.${lock.type}`)}
											</span>
										</svelte:fragment>

										<svelte:fragment slot="actions">
											<select
												class={inputInlineClass}
												value={lockDirection}
												on:change={(e) =>
													updateLockInline(lock.id, { direction: (e.currentTarget as HTMLSelectElement).value as any })}
											>
												<option value="desire">{t('dropdowns.desire')}</option>
												<option value="avoid">{t('dropdowns.avoid')}</option>
											</select>
											<select
												class={inputInlineClass}
												value={lock.priority}
												on:change={(e) => {
													void handleLockPriorityChange({
														lock,
														nextPriority: (e.currentTarget as HTMLSelectElement).value as any,
														direction: lockDirection
													});
												}}
											>
												<option value="hard">{t('dropdowns.hard')}</option>
												<option value="soft">{t('dropdowns.soft')}</option>
											</select>
											{#if lock.type === 'section'}
												<AppButton variant="secondary" size="sm" on:click={() => convertSectionLockToGroup(lock, lockDirection)}>
													{t('panels.solver.cardOps.convertToGroup')}
												</AppButton>
											{/if}
											{#if lock.type === 'group'}
												{#if convertingGroupLockId === lock.id}
													{@const candidates = groupLockCandidateEntries(lock)}
													<select class={inputInlineClass} bind:value={convertingGroupLockEntryId}>
														{#each candidates as entry (entry.id)}
															<option value={entry.id}>
																{entry.slot ?? t('courseCard.noTime')} · {entry.teacher || '-'}
															</option>
														{/each}
													</select>
													<AppButton
														variant="secondary"
														size="sm"
														on:click={() => convertGroupLockToSection(lock, convertingGroupLockEntryId, lockDirection)}
														disabled={!convertingGroupLockEntryId}
													>
														{t('panels.solver.groupAllowed.confirm')}
													</AppButton>
													<AppButton
														variant="secondary"
														size="sm"
														on:click={() => {
															convertingGroupLockId = null;
															convertingGroupLockEntryId = '';
														}}
													>
														{t('panels.solver.cancel')}
													</AppButton>
												{:else}
													<AppButton
														variant="secondary"
														size="sm"
														on:click={() => {
															const candidates = groupLockCandidateEntries(lock);
															if (!candidates.length) {
																message = t('panels.solver.groupAllowed.missingGroup');
																return;
															}
															convertingGroupLockId = lock.id;
															convertingGroupLockEntryId = candidates[0]?.id ?? '';
														}}
													>
														{t('panels.solver.cardOps.convertToSection')}
													</AppButton>
												{/if}
											{/if}
											<AppButton variant="secondary" size="sm" on:click={() => removeLock(lock.id)}>
												{t('panels.solver.removeConstraint')}
											</AppButton>
										</svelte:fragment>

										{#if lock.type === 'group'}
											{@const courseHashes = Array.from(new Set((lock.group?.courseHashes ?? []).filter(Boolean)))}
											{@const titles = courseHashes
												.map((courseHash) => courseCatalog.find((entry) => entry.courseHash === courseHash)?.title ?? '')
												.map((value) => value.trim())
												.filter(Boolean)}
											{@const uniqueTitles = Array.from(new Set(titles))}
											{@const visibleTitles = uniqueTitles.slice(0, 6)}
											{#if visibleTitles.length}
												<div class="flex flex-wrap gap-2">
													{#each visibleTitles as courseTitle (courseTitle)}
														<span class="inline-flex items-center rounded-[var(--app-radius-sm)] bg-[color-mix(in_srgb,var(--app-color-primary)_10%,transparent)] px-2 py-1 text-[var(--app-text-xs)] text-[var(--app-color-primary)]">
															{courseTitle}
														</span>
													{/each}
													{#if uniqueTitles.length > visibleTitles.length}
														<span class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
															+{uniqueTitles.length - visibleTitles.length}
														</span>
													{/if}
												</div>
											{/if}
										{/if}
									</SolverListCard>
								{/each}
							</div>
						{/if}
					</AppControlPanel>

				<AppControlPanel
					title={t('panels.solver.softLocks')}
					description={t('panels.solver.description')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					{#if selectedSoftLockIds.size > 0}
						<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1.5">
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.bulk.selected', { count: selectedSoftLockIds.size })}
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<label class="inline-flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									<span>{t('panels.solver.direction')}</span>
									<select class={inputDenseInlineClass} bind:value={bulkLockDirection} aria-label={t('panels.solver.direction')}>
										<option value="desire">{t('dropdowns.desire')}</option>
										<option value="avoid">{t('dropdowns.avoid')}</option>
									</select>
								</label>
								<label class="inline-flex items-center gap-2 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									<span>{t('panels.solver.priority')}</span>
									<select class={inputDenseInlineClass} bind:value={bulkLockPriority} aria-label={t('panels.solver.priority')}>
										<option value="hard">{t('dropdowns.hard')}</option>
										<option value="soft">{t('dropdowns.soft')}</option>
									</select>
								</label>
								<AppButton variant="secondary" size="sm" on:click={() => applyBulkLockPatch(selectedSoftLockIds)}>
									{t('panels.solver.bulk.apply')}
								</AppButton>
								<AppButton variant="danger" size="sm" on:click={() => removeSelectedLocks(selectedSoftLockIds)}>
									{t('panels.solver.bulk.remove')}
								</AppButton>
								<AppButton variant="secondary" size="sm" on:click={() => clearSelectedLocks(selectedSoftLockIds)}>
									{t('panels.solver.bulk.clear')}
								</AppButton>
							</div>
						</div>
					{/if}

					{#if visibleSoftLocks.length > 0}
						<div class="mb-3 flex flex-col gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							{#each visibleSoftLocks as lock (lock.id)}
								{@const lockDirection = lock.direction ?? (lock.type === 'time' ? 'avoid' : 'desire')}
								<SolverListCard
									density="dense"
									title={lockCardTitle(lock)}
									subtitle={describeLock(lock)}
									colorSeed={lock.type === 'group' ? (lock.group?.courseHashes?.[0] ?? lock.id) : (lock.courseHash ?? lock.id)}
								>
									<svelte:fragment slot="leading">
										<CardBulkCheckbox
											checked={selectedLockIds.has(lock.id)}
											ariaLabel={lock.id}
											on:toggle={() => toggleSelectedLock(lock.id)}
										/>
									</svelte:fragment>

									<svelte:fragment slot="meta">
										<span class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-0.5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
											{t(`panels.solver.lockTypeOptions.${lock.type}`)}
										</span>
									</svelte:fragment>

									<svelte:fragment slot="actions">
										<select
											class={inputInlineClass}
											value={lockDirection}
											on:change={(e) =>
												updateLockInline(lock.id, { direction: (e.currentTarget as HTMLSelectElement).value as any })}
										>
											<option value="desire">{t('dropdowns.desire')}</option>
											<option value="avoid">{t('dropdowns.avoid')}</option>
										</select>
										<select
											class={inputInlineClass}
											value={lock.priority}
											on:change={(e) => {
												void handleLockPriorityChange({
													lock,
													nextPriority: (e.currentTarget as HTMLSelectElement).value as any,
													direction: lockDirection
												});
											}}
										>
											<option value="hard">{t('dropdowns.hard')}</option>
											<option value="soft">{t('dropdowns.soft')}</option>
										</select>
										<AppButton variant="secondary" size="sm" on:click={() => removeLock(lock.id)}>
											{t('panels.solver.removeConstraint')}
										</AppButton>
									</svelte:fragment>

									{#if lock.type === 'group'}
										{@const courseHashes = Array.from(new Set((lock.group?.courseHashes ?? []).filter(Boolean)))}
										{@const titles = courseHashes
											.map((courseHash) => courseCatalog.find((entry) => entry.courseHash === courseHash)?.title ?? '')
											.map((value) => value.trim())
											.filter(Boolean)}
										{@const uniqueTitles = Array.from(new Set(titles))}
										{@const visibleTitles = uniqueTitles.slice(0, 6)}
										{#if visibleTitles.length}
											<div class="flex flex-wrap gap-2">
												{#each visibleTitles as courseTitle (courseTitle)}
													<span class="inline-flex items-center rounded-[var(--app-radius-sm)] bg-[color-mix(in_srgb,var(--app-color-primary)_10%,transparent)] px-2 py-1 text-[var(--app-text-xs)] text-[var(--app-color-primary)]">
														{courseTitle}
													</span>
												{/each}
												{#if uniqueTitles.length > visibleTitles.length}
													<span class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
														+{uniqueTitles.length - visibleTitles.length}
													</span>
												{/if}
											</div>
										{/if}
									{/if}
								</SolverListCard>
							{/each}
						</div>
					{/if}

					{#if selectedSoftIds.size > 0}
						<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1.5">
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{t('panels.solver.bulk.selected', { count: selectedSoftIds.size })}
							</div>
							<div class="flex flex-wrap items-center gap-2">
								{#if editingBulkSoftWeight}
									<input
										class={inputDenseInlineClass}
										type="number"
										min="1"
										size="4"
										bind:this={editingBulkSoftWeightInput}
										bind:value={editingBulkSoftWeightValue}
										on:keydown={(e) => {
											if (e.key === 'Escape') cancelBulkSoftWeightEdit();
											if (e.key === 'Enter') commitBulkSoftWeightEdit();
										}}
										on:blur={commitBulkSoftWeightEdit}
										aria-label={t('panels.solver.quickWeight')}
									/>
								{:else}
									<button
										type="button"
										class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-0.5 text-[var(--app-text-xs)] text-[var(--app-color-fg)]"
										on:click={beginBulkSoftWeightEdit}
										aria-label={t('panels.solver.quickWeight')}
									>
										{bulkSoftWeight}
									</button>
								{/if}
								<AppButton variant="secondary" size="sm" on:click={applyBulkSoftWeight}>
									{t('panels.solver.bulk.apply')}
								</AppButton>
								<AppButton variant="danger" size="sm" on:click={removeSelectedSoft}>
									{t('panels.solver.bulk.remove')}
								</AppButton>
								<AppButton variant="secondary" size="sm" on:click={() => (selectedSoftIds = new Set())}>
									{t('panels.solver.bulk.clear')}
								</AppButton>
							</div>
						</div>
					{/if}
					{#if visibleSoftConstraints.length === 0 && visibleSoftLocks.length === 0}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintEmpty')}</p>
						{:else if visibleSoftConstraints.length}
								<div class="flex flex-col gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
									{#each visibleSoftConstraints as constraint (constraint.id)}
										{@const softDirection = softDirectionFromType(constraint)}
										{@const isSectionSoft = isSectionPreferenceSoft(constraint)}
										{@const isGroupSoft = isGroupPreferenceSoft(constraint)}
										{@const sectionId = isSectionSoft && typeof constraint.params?.sectionId === 'string' ? constraint.params.sectionId : ''}
										{@const groupKey = isGroupSoft && typeof constraint.params?.groupKey === 'string' ? constraint.params.groupKey : ''}
										<SolverListCard
											density="dense"
											title={t(`panels.solver.softTypeOptions.${constraint.type}`)}
											subtitle={describeSoft(constraint)}
											colorSeed={constraint.type}
									>
										<svelte:fragment slot="leading">
											<CardBulkCheckbox
												checked={selectedSoftIds.has(constraint.id)}
												ariaLabel={constraint.id}
												on:toggle={() => toggleSelectedSoft(constraint.id)}
											/>
											</svelte:fragment>

											<svelte:fragment slot="meta">
												<span class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-0.5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
													{t(`panels.solver.softTypeOptions.${constraint.type}`)}
												</span>
											</svelte:fragment>

											<svelte:fragment slot="actions">
												{#if isSectionSoft || isGroupSoft}
													<select
														class={inputInlineClass}
														value={softDirection ?? 'avoid'}
														disabled={!softDirection}
														on:change={async (e) => {
															const nextDirection = (e.currentTarget as HTMLSelectElement).value as any;
															if (!softDirection) return;
															if (isSectionSoft) {
																const entry = sectionId ? resolveEntryBySectionId(sectionId) : null;
																if (!entry) {
																	message = t('dialogs.solverInvalid.reasons.soft.sectionNotFound');
																	return;
																}
																await applySectionPreference({
																	courseHash: entry.courseHash,
																	sectionId,
																	priority: 'soft',
																	direction: nextDirection,
																	weight: constraint.weight,
																	note: constraint.note
																});
																return;
															}
															if (isGroupSoft) {
																if (!groupKey) return;
																await upsertGroupSoftPreference({
																	groupKey,
																	direction: nextDirection,
																	weight: constraint.weight,
																	note: constraint.note
																});
															}
														}}
													>
														<option value="desire">{t('dropdowns.desire')}</option>
														<option value="avoid">{t('dropdowns.avoid')}</option>
													</select>
													<select
														class={inputInlineClass}
														value="soft"
														on:change={async (e) => {
															const next = (e.currentTarget as HTMLSelectElement).value as any;
															if (next !== 'hard') return;
															if (!softDirection) return;
															if (isSectionSoft) {
																const entry = sectionId ? resolveEntryBySectionId(sectionId) : null;
																if (!entry) {
																	message = t('dialogs.solverInvalid.reasons.soft.sectionNotFound');
																	return;
																}
																await applySectionPreference({
																	courseHash: entry.courseHash,
																	sectionId,
																	priority: 'hard',
																	direction: softDirection,
																	weight: constraint.weight,
																	note: constraint.note
																});
																return;
															}
															if (isGroupSoft) {
																await convertSoftGroupToHardLock(constraint);
															}
														}}
													>
														<option value="soft">{t('dropdowns.soft')}</option>
														<option value="hard">{t('dropdowns.hard')}</option>
													</select>
												{/if}

												{#if editingSoftWeightId === constraint.id}
													<input
														class={inputInlineClass}
														type="number"
														min="1"
														size="4"
														bind:this={editingSoftWeightInput}
														bind:value={editingSoftWeightValue}
														on:keydown={(e) => {
															if (e.key === 'Escape') cancelSoftWeightEdit();
															if (e.key === 'Enter') void commitSoftWeightEdit(constraint.id);
														}}
														on:blur={() => void commitSoftWeightEdit(constraint.id)}
														aria-label={t('panels.solver.quickWeight')}
													/>
												{:else}
													<button
														type="button"
														class="inline-flex items-center rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-2 py-0.5 text-[var(--app-text-xs)] text-[var(--app-color-fg)]"
														on:click={() => beginSoftWeightEdit(constraint)}
														aria-label={t('panels.solver.quickWeight')}
													>
														{constraint.weight}
													</button>
												{/if}

												{#if isSectionSoft}
													<AppButton variant="secondary" size="sm" on:click={() => convertSoftSectionToGroup(constraint)}>
														{t('panels.solver.cardOps.convertToGroup')}
													</AppButton>
												{/if}
												{#if isGroupSoft}
													{#if convertingGroupSoftId === constraint.id}
														{@const candidates = groupKey ? getGroupEntries(groupKey) : []}
														<select class={inputInlineClass} bind:value={convertingGroupSoftEntryId}>
															{#each candidates as entry (entry.id)}
																<option value={entry.id}>
																	{entry.slot ?? t('courseCard.noTime')} · {entry.teacher || '-'}
																</option>
															{/each}
														</select>
														<AppButton
															variant="secondary"
															size="sm"
															on:click={() => convertSoftGroupToSection(constraint, convertingGroupSoftEntryId)}
															disabled={!convertingGroupSoftEntryId}
														>
															{t('panels.solver.groupAllowed.confirm')}
														</AppButton>
														<AppButton
															variant="secondary"
															size="sm"
															on:click={() => {
																convertingGroupSoftId = null;
																convertingGroupSoftEntryId = '';
															}}
														>
															{t('panels.solver.cancel')}
														</AppButton>
													{:else}
														<AppButton
															variant="secondary"
															size="sm"
															on:click={() => {
																const candidates = groupKey ? getGroupEntries(groupKey) : [];
																if (!candidates.length) {
																	message = t('panels.solver.groupAllowed.missingGroup');
																	return;
																}
																convertingGroupSoftId = constraint.id;
																convertingGroupSoftEntryId = candidates[0]?.id ?? '';
															}}
														>
															{t('panels.solver.cardOps.convertToSection')}
														</AppButton>
													{/if}
												{/if}

												<AppButton variant="secondary" size="sm" on:click={() => removeSoft(constraint.id)}>
													{t('panels.solver.removeConstraint')}
												</AppButton>
											</svelte:fragment>
										</SolverListCard>
								{/each}
							</div>
						{/if}
					</AppControlPanel>

				<AppControlPanel
					title={t('panels.solver.solverResultTitle')}
					description={t('panels.solver.solverResultHint')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<AppButton variant="primary" size="sm" on:click={runSolver} disabled={solving}>
					{solving ? t('panels.solver.solving') : t('panels.solver.run')}
				</AppButton>
			</div>

			{#if solving}
				<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t('panels.solver.solverResultSolving')}
				</p>
			{:else if !latestResult}
				<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t('panels.solver.solverResultHint')}
				</p>
	{:else if latestResult.status === 'unsat'}
		<div class="mt-3 flex flex-col gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
			<p class="m-0">
				{t('panels.solver.solverResultStatusLabel')}
				{t('panels.solver.solverResultStatusInfeasible')}
			</p>
					<div class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2">
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">{t('panels.solver.unsatHint')}</p>
						<p class="mt-1 mb-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.solver.unsatSoftHint')}</p>
					</div>
					{#if latestResult.diagnostics?.length}
						<div class="mt-1">
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.solver.unsatDiagnosticsTitle')}</div>
							<ul class="mt-1 mb-0 flex flex-col gap-1 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{#each latestResult.diagnostics as diag, index (diag.label + (diag.reason ?? '') + index)}
									<li class="break-words [overflow-wrap:anywhere]">
										{diag.label}{diag.reason ? ` · ${diag.reason}` : ''}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if latestResult.unsatCore?.length}
						<div class="mt-1">
							<div class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{t('panels.solver.unsatCoreTitle')}</div>
							<ul class="mt-1 mb-0 flex flex-col gap-1 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
								{#each latestResult.unsatCore.slice(0, 12) as atom, index (atom + index)}
									<li class="font-mono break-words [overflow-wrap:anywhere]">{atom}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
	{:else}
		<div class="mt-3 flex flex-col gap-3">
			<div class="flex flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
				<p class="m-0">
					{t('panels.solver.solverResultStatusLabel')}
					{t('panels.solver.solverResultStatusFeasible')}
				</p>
				<p class="m-0">
					{t('panels.solver.solutionSummary', { count: solutionCount })}
				</p>
			</div>
			{#if solutionPreviewItems.length === 0}
				<p class="m-0 text-[var(--app-color-fg-muted)]">{t('panels.solver.solutionEmpty')}</p>
			{:else}
				<ul class="m-0 flex flex-col gap-2 pl-0">
					{#each solutionPreviewItems as item, index (item.key)}
						<li class="list-none">
							<CourseCard
								id={item.entry?.id ?? item.key}
								title={item.title}
								teacher={item.teacher}
								time={item.time}
								courseCode={item.courseCode}
								credit={item.credit}
								colorSeed={item.entry?.id ?? item.key}
								toneIndex={index}
								hoverable={true}
								onHover={() => {}}
								onLeave={() => {}}
								capacity={item.capacity ?? 0}
								vacancy={item.vacancy ?? 0}
								specialTags={item.specialTags}
							/>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex flex-wrap items-center gap-2">
				<select class={inputClass} bind:value={applyMode} disabled={actionBusy || solving}>
					<option value="merge">{t('panels.actionLog.override.merge')}</option>
					<option value="replace-all">{t('panels.actionLog.override.replace-all')}</option>
				</select>
				<AppButton variant="secondary" size="sm" on:click={applyLatestResult} disabled={actionBusy || solving || !latestResult.plan.length}>
					{t('panels.solver.apply')}
				</AppButton>
				<AppButton variant="secondary" size="sm" on:click={undoApplyLatest} disabled={actionBusy || solving || !canUndoApply}>
					{t('panels.solver.undoApply')}
				</AppButton>
			</div>
		</div>
	{/if}
				</AppControlPanel>
			</div>
		{/if}
	</ListSurface>
</DockPanelShell>
