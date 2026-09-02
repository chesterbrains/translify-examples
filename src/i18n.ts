import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { TranslifyConfig } from './translify/types';
import { createBackend } from './translify/backend';
import { appendMissingKey } from './diagnostics/exchange-log';

/**
 * Bundle keys arrive flat as `namespace.keyName`, so both separators are off —
 * with the defaults, `t('cart.title')` does a nested lookup and misses.
 * `load: 'currentOnly'` stops `it-IT` being truncated to a locale that is not enabled.
 */
export const initI18n = async (config: TranslifyConfig): Promise<i18n> => {
  await i18next
    .use(createBackend(config))
    .use(initReactI18next)
    .init({
      supportedLngs: config.locales,
      lng: config.locales[0],
      fallbackLng: config.locales[0],
      load: 'currentOnly',
      keySeparator: false,
      nsSeparator: false,
      ns: ['translation'],
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      parseMissingKeyHandler: (key: string): string => {
        appendMissingKey(key);

        return `⟨${key}⟩`;
      },
    });

  return i18next;
};

/**
 * `fallbackLng` means a key missing only in the current language (but present
 * in the fallback) resolves silently — `parseMissingKeyHandler` never fires,
 * so the gap never reaches the Missing keys list. This checks the current
 * language alone, with fallback off for the check only, so that case is
 * still recorded even though `t()` still renders the fallback value.
 */
export const translateAndDiagnose = (instance: i18n, t: (key: string) => string, key: string): string => {
  if (!instance.exists(key, { lng: instance.language, fallbackLng: false })) {
    appendMissingKey(key);
  }

  return t(key);
};
