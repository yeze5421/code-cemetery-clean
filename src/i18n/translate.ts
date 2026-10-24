import type { Locale } from '../core/types';
import { appEnglish } from './app.en';
import { dialogEnglish } from './dialogs.en';
import { serverEnglish } from './server.en';
import { desktopEnglish } from './desktop.en';

export type TranslationValues = Record<string, string | number>;
export const englishMessages: Readonly<Record<string, string>> = {
  ...appEnglish,
  ...dialogEnglish,
  ...serverEnglish,
  ...desktopEnglish,
};
export function normalizeLocale(value: unknown): Locale {
  return typeof value === 'string' && /^en(?:[-_;,]|$)/i.test(value) ? 'en' : 'zh-CN';
}
export function translate(locale: Locale, message: string, values: TranslationValues = {}): string {
  const template = locale === 'en' ? (englishMessages[message] ?? message) : message;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
export function createTranslator(locale: Locale) {
  return (message: string, values?: TranslationValues) => translate(locale, message, values);
}
