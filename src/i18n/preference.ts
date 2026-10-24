import { normalizeLocale } from './translate';
import type { Locale } from '../core/types';
export const LOCALE_STORAGE_KEY = 'code-cemetery.locale';
export function readLocale(): Locale {
  try {
    return normalizeLocale(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return 'zh-CN';
  }
}
export function saveLocale(locale: Locale) {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* Session-only when storage is unavailable. */
  }
}
