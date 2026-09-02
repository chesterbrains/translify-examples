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
