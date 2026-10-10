import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranslifyConfig } from './types';
import { createBackend, stripNamespace } from './backend';

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
