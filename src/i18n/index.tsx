import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { en } from './locales/en';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zhHant } from './locales/zh-Hant';
import { LOCALE_OPTIONS, type Locale, type Translations } from './types';

export { LOCALE_OPTIONS, type Locale, type Translations } from './types';

const LOCALE_STORAGE_KEY = 'vte_locale_v1';

const dictionaries: Record<Locale, Translations> = {
  ja,
  en,
  ko,
  'zh-Hant': zhHant,
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value === 'ja' || value === 'en' || value === 'ko' || value === 'zh-Hant';
}

export function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }

  const candidates = typeof navigator !== 'undefined'
    ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
    : [];

  for (const raw of candidates) {
    const lower = raw.toLowerCase();
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ko')) return 'ko';
    if (
      lower.startsWith('zh-hant')
      || lower.startsWith('zh-tw')
      || lower.startsWith('zh-hk')
      || lower.startsWith('zh-mo')
    ) {
      return 'zh-Hant';
    }
    if (lower.startsWith('en')) return 'en';
  }

  return 'en';
}

export function formatMessage(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  fmt: typeof formatMessage;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'ja',
  setLocale: () => {},
  t: ja,
  fmt: formatMessage,
});

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    const option = LOCALE_OPTIONS.find((item) => item.code === locale);
    if (option && typeof document !== 'undefined') {
      document.documentElement.lang = option.htmlLang;
    }
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage access errors
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: dictionaries[locale],
      fmt: formatMessage,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
