import type { TranslifyConfig } from './types';

export const DEFAULT_BASE_URL = 'https://translify.tommasofeltrin.work/api';

export type ConfigResult =
  | { ok: true; config: TranslifyConfig }
  | { ok: false; missing: string[] };

const splitLocales = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/**
 * Validate the build-time environment. Every gap is reported at once so a
 * misconfiguration presents as a setup screen, never as a 404 hunt.
 */
export const readConfig = (env: Record<string, string | undefined>): ConfigResult => {
  const projectSlug = (env.VITE_TRANSLIFY_PROJECT_SLUG ?? '').trim();
  const envSlug = (env.VITE_TRANSLIFY_ENV_SLUG ?? '').trim();
  const apiKey = (env.VITE_TRANSLIFY_API_KEY ?? '').trim();
  const locales = splitLocales(env.VITE_TRANSLIFY_LOCALES);

  const missing: string[] = [];
  if (projectSlug === '') missing.push('VITE_TRANSLIFY_PROJECT_SLUG');
  if (envSlug === '') missing.push('VITE_TRANSLIFY_ENV_SLUG');
  if (apiKey === '') missing.push('VITE_TRANSLIFY_API_KEY');
  if (locales.length === 0) missing.push('VITE_TRANSLIFY_LOCALES');

  if (missing.length > 0) return { ok: false, missing };

  const rawBase = (env.VITE_TRANSLIFY_BASE_URL ?? '').trim();
  const baseUrl = (rawBase === '' ? DEFAULT_BASE_URL : rawBase).replace(/\/+$/, '');

  return { ok: true, config: { baseUrl, projectSlug, envSlug, apiKey, locales } };
};
