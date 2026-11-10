import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslifyConfig } from '../config';
import { buildDeliveryPath, maskKey, rawFetch, toExchange, withKey } from './raw-fetch';

const config: TranslifyConfig = {
  baseUrl: 'http://localhost:3000/api',
  projectSlug: 'acme-ecom',
  envSlug: 'production',
  apiKey: 'pk_abc123',
  locales: ['en-US', 'it-IT'],
};

describe('buildDeliveryPath', () => {
  it('builds the plain bundle path', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe' })).toBe('/delivery/acme-ecom/production/it-IT');
  });

  it('appends a namespace filter', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', namespace: 'cart' })).toBe(
      '/delivery/acme-ecom/production/it-IT?namespace=cart',
    );
  });

  it('honours slug overrides so probes can aim at the wrong project', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', projectSlug: 'not-a-project' })).toBe(
      '/delivery/not-a-project/production/it-IT',
    );
  });

  it('appends extra query parameters', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', extraQuery: { foo: 'bar' } })).toBe(
      '/delivery/acme-ecom/production/it-IT?foo=bar',
    );
  });

  it('adds the key through the same URLSearchParams as the other parameters', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe', namespace: 'cart' }, 'k')).toBe(
      '/delivery/acme-ecom/production/it-IT?namespace=cart&key=k',
    );
  });

  it('encodes characters that would break the query', () => {
    expect(buildDeliveryPath(config, { locale: 'it-IT', label: 'probe' }, 'a+b/c=d&e')).toBe(
      '/delivery/acme-ecom/production/it-IT?key=a%2Bb%2Fc%3Dd%26e',
    );
  });
});

describe('withKey', () => {
  it('appends the key as the first parameter', () => {
    expect(withKey('/delivery/a/b/it-IT', 'pk_abc')).toBe('/delivery/a/b/it-IT?key=pk_abc');
  });

  it('appends after existing parameters', () => {
    expect(withKey('/delivery/a/b/it-IT?namespace=cart', 'k')).toBe('/delivery/a/b/it-IT?namespace=cart&key=k');
  });

  it('appends a masked key verbatim, for display', () => {
    expect(withKey('/p', '••••••••c123')).toBe('/p?key=••••••••c123');
  });
});

describe('toExchange', () => {
  const base = { label: 'probe: x', path: '/delivery/acme-ecom/production/it-IT' };

  it('records an http outcome', () => {
    const exchange = toExchange({ ...base, ms: 40, status: 200, body: { 'cart.title': 'Carrello' } });
    expect(exchange.outcome).toEqual({ kind: 'http', status: 200, body: { 'cart.title': 'Carrello' } });
  });

  it('records a 404 as an http outcome, not an error', () => {
    const exchange = toExchange({ ...base, ms: 12, status: 404, body: { message: 'Not Found' } });
    expect(exchange.outcome).toEqual({ kind: 'http', status: 404, body: { message: 'Not Found' } });
  });

  it('records a thrown fetch as a network outcome', () => {
    const exchange = toExchange({ ...base, ms: 3, error: new TypeError('Failed to fetch') });
    expect(exchange.outcome).toEqual({ kind: 'network', message: 'Failed to fetch' });
  });

  it('keeps the ETag when the response carried one', () => {
    const exchange = toExchange({ ...base, ms: 40, status: 200, body: {}, etag: '"abc"' });
    expect(exchange.etag).toBe('"abc"');
  });

  it('infers nothing about where the bytes came from', () => {
    const exchange = toExchange({ ...base, ms: 1, status: 200, body: {} });
    expect('source' in exchange).toBe(false);
  });
});

describe('rawFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (): ReturnType<typeof vi.fn> => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
  };

  it('sends the key in the query string, not in a header', async () => {
    const fetchMock = stubFetch();

    await rawFetch(config, { locale: 'it-IT', label: 'probe' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:3000/api/delivery/acme-ecom/production/it-IT?key=${config.apiKey}`);
    expect(new Headers(init.headers).has('X-Api-Key')).toBe(false);
  });

  it('omits the key entirely for apiKey: null', async () => {
    const fetchMock = stubFetch();

    await rawFetch(config, { locale: 'it-IT', label: 'probe', apiKey: null });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/delivery/acme-ecom/production/it-IT');
  });

  it('records the path with the key masked', async () => {
    stubFetch();

    const exchange = await rawFetch(config, { locale: 'it-IT', label: 'probe' });

    expect(exchange.path).toBe(`/delivery/acme-ecom/production/it-IT?key=${maskKey(config.apiKey)}`);
    expect(exchange.path).not.toContain(config.apiKey);
  });

  it('always bypasses the browser cache', async () => {
    const fetchMock = stubFetch();

    await rawFetch(config, { locale: 'it-IT', label: 'probe' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe('reload');
  });

  it('never sends a conditional header', async () => {
    const fetchMock = stubFetch();

    await rawFetch(config, { locale: 'it-IT', label: 'probe' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has('If-None-Match')).toBe(false);
  });

  it('records the ETag the response exposed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { ETag: '"abc"' } })));

    const exchange = await rawFetch(config, { locale: 'it-IT', label: 'probe' });

    expect(exchange.etag).toBe('"abc"');
  });
});
