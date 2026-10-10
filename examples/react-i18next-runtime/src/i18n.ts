import i18next, { type i18n, type InitOptions } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import type { TranslifyConfig } from './translify/types';
import { createBackend } from './translify/backend';
import { appendMissingKey } from './diagnostics/exchange-log';

/**
 * One i18next namespace per Translify namespace (`cart`), bare keys inside it.
 * `keySeparator: false` because catalog keys are flat identifiers; `load: 'currentOnly'`
 * stops `it-IT` being truncated to a locale that is not enabled in the project.
 */
export const I18N_OPTIONS = (locales: string[]): InitOptions => ({
  supportedLngs: locales,
  lng: locales[0],
  fallbackLng: locales[0],
  load: 'currentOnly',
  keySeparator: false,
  nsSeparator: ':',
  ns: ['cart'],
  defaultNS: 'cart',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  parseMissingKeyHandler: (key: string): string => {
    appendMissingKey(key);

    return `⟨${key}⟩`;
  },
});

/** Plurals and arguments are ICU in Translify, so i18next formats them with ICU too. */
export const initI18n = async (config: TranslifyConfig): Promise<i18n> => {
  await i18next.use(ICU).use(createBackend(config)).use(initReactI18next).init(I18N_OPTIONS(config.locales));

  return i18next;
};

/**
 * `fallbackLng` means a key missing only in the current language (but present
 * in the fallback) resolves silently — `parseMissingKeyHandler` never fires,
 * so the gap never reaches the Missing keys list. This checks the current
 * language alone, with fallback off for the check only, so that case is
 * still recorded even though `t()` still renders the fallback value.
 */
export const translateAndDiagnose = (
  instance: i18n,
  t: (key: string, options?: Record<string, unknown>) => string,
  key: string,
  options?: Record<string, unknown>,
): string => {
  if (!instance.exists(key, { lng: instance.language, fallbackLng: false })) {
    appendMissingKey(key);
  }

  return t(key, options);
};
