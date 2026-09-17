import en from './en.json';
import ar from './ar.json';
import { DEFAULT_LOCALE, RTL_LOCALES, type SupportedLocale } from '@velocity-island/shared';

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<SupportedLocale, Dictionary> = { en, ar };
const STORAGE_KEY = 'vi-locale';

let currentLocale: SupportedLocale = loadStoredLocale();

function loadStoredLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {
    // Storage unavailable — fall through to default.
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function isRTL(locale: SupportedLocale = currentLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore persistence failure (private mode, etc).
  }
  document.documentElement.lang = locale;
  document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
}

/** Translates `key`, substituting `{param}` placeholders from `params`. Falls back to
 * English, then to the raw key, so a missing translation never renders as blank UI. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[currentLocale];
  let value = dict[key] ?? DICTIONARIES.en[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
}

export function initI18n(): void {
  setLocale(currentLocale);
}
