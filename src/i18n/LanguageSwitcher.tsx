import { Languages } from 'lucide-react';
import { useI18n } from './react';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t('界面语言')}>
      <Languages size={14} aria-hidden="true" />
      <button
        type="button"
        lang="zh-CN"
        aria-label="切换为中文"
        aria-pressed={locale === 'zh-CN'}
        onClick={() => setLocale('zh-CN')}
      >
        中
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        lang="en"
        aria-label="Switch to English"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}
