import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslifyConfig } from './types';
import type { BackendModule } from 'i18next';
import { createBackend, setForceRevalidate, stripNamespace } from './backend';

const config: TranslifyConfig = {
  baseUrl: 'http://localhost:3000/api',
  projectSlug: 'acme-ecom',
  envSlug: 'production',
  apiKey: 'pk_abc123',
  locales: ['en-US', 'it-IT'],
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stripNamespace', () => {
  it('drops the namespace prefix the delivery endpoint puts on every key', () => {
    expect(stripNamespace({ 'cart.cartTitle': 'Your cart', 'cart.checkout': 'Checkout' }, 'cart')).toEqual({
      cartTitle: 'Your cart',
      checkout: 'Checkout',
    });
  });

  it('ignores keys from another namespace instead of mis-filing them', () => {
    expect(stripNamespace({ 'cart.cartTitle': 'Your cart', 'common.appName': 'Acme' }, 'cart')).toEqual({
      cartTitle: 'Your cart',
    });
  });
});

describe('createBackend().read', () => {
  it('requests one namespace and resolves it as that i18next namespace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ 'cart.cartTitle': 'Il tuo carrello' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new Promise<unknown>((resolve, reject) => {
      createBackend(config).read('it-IT', 'cart', (error, data) => (error ? reject(error) : resolve(data)));
    });

    expect(result).toEqual({ cartTitle: 'Il tuo carrello' });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/api/delivery/acme-ecom/production/it-IT');
    expect(url.searchParams.get('namespace')).toBe('cart');
    expect(url.searchParams.get('key')).toBe('pk_abc123');
  });

  it('fails the read on a non-200 so i18next reports it instead of rendering an empty namespace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Unauthorized' }, 401)));

    await expect(
      new Promise((resolve, reject) => {
        createBackend(config).read('it-IT', 'cart', (error, data) => (error ? reject(error) : resolve(data)));
      }),
    ).rejects.toThrow('delivery returned 401');
  });
});

describe('createBackend().read under Force revalidate', () => {
  const read = (backend: BackendModule, language: string, namespace: string): Promise<unknown> =>
    new Promise((resolve, reject) => {
      backend.read(language, namespace, (error, data) => (error ? reject(error) : resolve(data)));
    });

  const withEtag = (body: unknown, etag: string): Response =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ETag: etag } });

  afterEach(() => {
    setForceRevalidate(false);
  });

  it('revalidates with the ETag of the bundle it holds and keeps that bundle on a 304', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(withEtag({ 'cart.cartTitle': 'Il tuo carrello' }, '"v1"'))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"v1"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const backend = createBackend(config);

    await read(backend, 'it-IT', 'cart');
    setForceRevalidate(true);
    const result = await read(backend, 'it-IT', 'cart');

    expect(result).toEqual({ cartTitle: 'Il tuo carrello' });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(init.headers).get('If-None-Match')).toBe('"v1"');
  });

  it('takes the new bundle and its ETag when the revalidation answers 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(withEtag({ 'cart.cartTitle': 'Il tuo carrello' }, '"v1"'))
      .mockResolvedValueOnce(withEtag({ 'cart.cartTitle': 'Carrello' }, '"v2"'))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"v2"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const backend = createBackend(config);

    await read(backend, 'it-IT', 'cart');
    setForceRevalidate(true);
    expect(await read(backend, 'it-IT', 'cart')).toEqual({ cartTitle: 'Carrello' });
    expect(await read(backend, 'it-IT', 'cart')).toEqual({ cartTitle: 'Carrello' });

    const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new Headers(init.headers).get('If-None-Match')).toBe('"v2"');
  });

  it('bypasses the HTTP cache instead when it holds no ETag for the namespace yet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ 'cart.cartTitle': 'Il tuo carrello' }));
    vi.stubGlobal('fetch', fetchMock);
    setForceRevalidate(true);

    await read(createBackend(config), 'it-IT', 'cart');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe('reload');
    expect(new Headers(init.headers).has('If-None-Match')).toBe(false);
  });

  it('does not send a conditional request on an ordinary read, so the browser cache stays in charge', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(withEtag({ 'cart.cartTitle': 'Il tuo carrello' }, '"v1"'))
      .mockResolvedValueOnce(withEtag({ 'cart.cartTitle': 'Il tuo carrello' }, '"v1"'));
    vi.stubGlobal('fetch', fetchMock);
    const backend = createBackend(config);

    await read(backend, 'it-IT', 'cart');
    await read(backend, 'it-IT', 'cart');

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(init.headers).has('If-None-Match')).toBe(false);
    expect(init.cache).toBe('default');
  });

  it('fails a 304 it cannot honour because the bundle was never held', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })));

    await expect(read(createBackend(config), 'it-IT', 'cart')).rejects.toThrow('delivery returned 304');
  });
});
