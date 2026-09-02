import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, readConfig } from './config';

const complete = {
  VITE_TRANSLIFY_BASE_URL: 'http://localhost:3000/api',
  VITE_TRANSLIFY_PROJECT_SLUG: 'acme-ecom',
  VITE_TRANSLIFY_ENV_SLUG: 'production',
  VITE_TRANSLIFY_API_KEY: 'tlf_live_abc123',
  VITE_TRANSLIFY_LOCALES: 'en-US,it-IT',
};

describe('readConfig', () => {
  it('accepts a complete environment', () => {
    const result = readConfig(complete);
    expect(result).toEqual({
      ok: true,
      config: {
        baseUrl: 'http://localhost:3000/api',
        projectSlug: 'acme-ecom',
        envSlug: 'production',
        apiKey: 'tlf_live_abc123',
        locales: ['en-US', 'it-IT'],
      },
    });
  });

  it('defaults the base URL when it is absent', () => {
    const result = readConfig({ ...complete, VITE_TRANSLIFY_BASE_URL: undefined });
    expect(result.ok && result.config.baseUrl).toBe(DEFAULT_BASE_URL);
  });

  it('strips a trailing slash from the base URL', () => {
    const result = readConfig({ ...complete, VITE_TRANSLIFY_BASE_URL: 'http://localhost:3000/api/' });
    expect(result.ok && result.config.baseUrl).toBe('http://localhost:3000/api');
  });

  it('trims and splits the locale list', () => {
    const result = readConfig({ ...complete, VITE_TRANSLIFY_LOCALES: ' en-US , it-IT ,' });
    expect(result.ok && result.config.locales).toEqual(['en-US', 'it-IT']);
  });

  it('reports a missing api key', () => {
    const result = readConfig({ ...complete, VITE_TRANSLIFY_API_KEY: '' });
    expect(result).toEqual({ ok: false, missing: ['VITE_TRANSLIFY_API_KEY'] });
  });

  it('treats a locale list of only separators as missing', () => {
    const result = readConfig({ ...complete, VITE_TRANSLIFY_LOCALES: ' , ' });
    expect(result).toEqual({ ok: false, missing: ['VITE_TRANSLIFY_LOCALES'] });
  });

  it('lists every missing variable in declaration order', () => {
    const result = readConfig({});
    expect(result).toEqual({
      ok: false,
      missing: [
        'VITE_TRANSLIFY_PROJECT_SLUG',
        'VITE_TRANSLIFY_ENV_SLUG',
        'VITE_TRANSLIFY_API_KEY',
        'VITE_TRANSLIFY_LOCALES',
      ],
    });
  });
});
