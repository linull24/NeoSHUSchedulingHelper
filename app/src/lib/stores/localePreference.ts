import { locale, type LocaleId } from '../i18n/localeStore';

export { locale };
export type { LocaleId };

export function setLocale(value: LocaleId) {
  locale.set(value);
}
