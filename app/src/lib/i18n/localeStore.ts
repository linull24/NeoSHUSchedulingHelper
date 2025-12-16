import { writable } from 'svelte/store';

export type LocaleId = 'zh-CN' | 'en-US';

const STORAGE_KEY = 'shu-course-scheduler:locale';
const defaultLocale: LocaleId = (typeof localStorage !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as LocaleId)) || 'zh-CN';

export const locale = writable<LocaleId>(defaultLocale);

locale.subscribe((value) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, value);
});
