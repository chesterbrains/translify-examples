import i18next, { type i18n, type InitOptions } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import type { TranslifyClient } from '@translifyhq/client';
import type { TranslifyConfig } from './config';
import { createBackend } from './translify-backend';
import { appendClientEvent } from './diagnostics/client-events';
import { appendMissingKey } from './diagnostics/exchange-log';

/** i18next namespaces map 1:1 to Translify namespaces; the client loads exactly these. */
export const NAMESPACES = ['cart'] as const;

/**
 * Plurals and arguments are ICU in Translify, so i18next formats them with ICU too.
 * The plugin memoises each compiled message per `lng.ns.key` without looking at the value,
 * so it must drop that cache when the backend replaces a namespace: `bindI18nStore: 'added'`
 * is the same event react-i18next re-renders on. Without it a publish would re-render the
 * page with the old compiled strings.
 */
export const createIcu = (): InstanceType<typeof ICU> => new ICU({ bindI18nStore: 'added' });

/**
 * One i18next namespace per Translify namespace (`cart`), bare keys inside it.
 * `keySeparator: false` because catalog keys are flat identifiers; `load: 'currentOnly'`
 * stops `it-IT` being truncated to a locale that is not enabled in the project.
 * `react.bindI18nStore: 'added'` re-renders every `useTranslation` when the backend
 * replaces a namespace after a publish.
 */
export const I18N_OPTIONS = (locales: string[]): InitOptions => ({
  supportedLngs: locales,
  lng: locales[0],
  fallbackLng: locales[0],
  load: 'currentOnly',
  keySeparator: false,
  nsSeparator: ':',
  ns: [...NAMESPACES],
  defaultNS: NAMESPACES[0],
  interpolation: { escapeValue: false },
  react: { useSuspense: false, bindI18nStore: 'added' },
  parseMissingKeyHandler: (key: string): string => {
    appendMissingKey(key);

    return `⟨${key}⟩`;
  },
});

export const initI18n = async (client: TranslifyClient, config: TranslifyConfig): Promise<i18n> => {
  await i18next
    .use(createIcu())
    .use(createBackend(client, NAMESPACES, { onEvent: appendClientEvent }))
    .use(initReactI18next)
    .init(I18N_OPTIONS(config.locales));

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
