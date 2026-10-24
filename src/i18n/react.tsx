import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '../core/types';
import { createTranslator } from './translate';
import { readLocale, saveLocale, LOCALE_STORAGE_KEY } from './preference';

const LocaleContext = createContext({
  locale: 'zh-CN' as Locale,
  setLocale: (_locale: Locale) => {},
  t: createTranslator('zh-CN'),
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(readLocale);
  const setLocale = (next: Locale) => {
    saveLocale(next);
    updateLocale(next);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    document.title =
      locale === 'en' ? 'Code Cemetery · A home for unfinished ideas' : '代码墓地 · Code Cemetery';
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY) updateLocale(readLocale());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: createTranslator(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}
export const useI18n = () => useContext(LocaleContext);
