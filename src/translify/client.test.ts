import { describe, expect, it } from 'vitest';
import type { TranslifyConfig } from './types';
import { buildDeliveryPath, toExchange } from './client';

const config: TranslifyConfig = {
  baseUrl: 'http://localhost:3000/api',
  projectSlug: 'acme-ecom',
  envSlug: 'production',
  apiKey: 'tlf_live_abc123',
  locales: ['en-US', 'it-IT'],
};

describe('buildDeliveryPath', () => {
  it('builds the plain bundle path', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'app' })).toBe(
      '/delivery/acme-ecom/production/it-IT',
    );
  });

  it('appends a namespace filter', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'app', namespace: 'cart' })).toBe(
      '/delivery/acme-ecom/production/it-IT?namespace=cart',
    );
  });

  it('honours slug overrides so probes can aim at the wrong project', () => {
    expect(
      buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', projectSlug: 'not-a-project' }),
    ).toBe('/delivery/not-a-project/production/it-IT');
  });

  it('appends extra query parameters', () => {
    expect(
      buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', extraQuery: { foo: 'bar' } }),
    ).toBe('/delivery/acme-ecom/production/it-IT?foo=bar');
  });
});

describe('toExchange', () => {
  const base = { label: 'app: it-IT', path: '/delivery/acme-ecom/production/it-IT' };

  it('records an http outcome', () => {
    const exchange = toExchange({ ...base, ms: 40, status: 200, body: { 'cart.title': 'Carrello' } });
    expect(exchange.outcome).toEqual({ kind: 'http', status: 200, body: { 'cart.title': 'Carrello' } });
    expect(exchange.source).toBe('network');
  });

  it('records a 404 as an http outcome, not an error', () => {
    const exchange = toExchange({ ...base, ms: 12, status: 404, body: { message: 'Not Found' } });
    expect(exchange.outcome).toEqual({ kind: 'http', status: 404, body: { message: 'Not Found' } });
  });

  it('records a thrown fetch as a network outcome', () => {
    const exchange = toExchange({ ...base, ms: 3, error: new TypeError('Failed to fetch') });
    expect(exchange.outcome).toEqual({ kind: 'network', message: 'Failed to fetch' });
  });

  it('labels a very fast response as likely cache', () => {
    const exchange = toExchange({ ...base, ms: 1, status: 200, body: {} });
    expect(exchange.source).toBe('likely-cache');
  });
});
