import { describe, expect, it, vi } from 'vitest';
import type { BackendModule, Services } from 'i18next';
import { TranslifyError, type TranslifyBundle, type TranslifyClient } from '@translifyhq/client';
import type { ClientEvent } from './diagnostics/client-events';
import { createBackend, stripNamespace, type ResourceWriter } from './translify-backend';

const fakeClient = (bundles: Record<string, TranslifyBundle>) => {
  const listeners = new Set<() => void>();
  const current: Record<string, TranslifyBundle | undefined> = { ...bundles };
  const client: TranslifyClient = {
    load: vi.fn(async (locale: string) => {
      const bundle = current[locale];
      if (bundle === undefined) throw new TranslifyError('NOT_FOUND', 'nothing published', 404);
      for (const listener of listeners) listener(); // the client notifies when a bundle gets its first identity
      return bundle;
    }),
    get: (locale, key) => current[locale]?.[key],
    bundle: (locale) => current[locale],
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: vi.fn(),
    dispose: vi.fn(),
  };
  const set = (locale: string, bundle: TranslifyBundle): void => {
    current[locale] = bundle;
    for (const listener of listeners) listener();
  };
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return { client, set, notify };
};

const fakeStore = () => ({ addResourceBundle: vi.fn(), removeResourceBundle: vi.fn() });

const init = (backend: BackendModule, store: ResourceWriter): void => {
  backend.init({ resourceStore: store } as unknown as Services, {}, {});
};

const read = (backend: BackendModule, language: string, namespace: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    backend.read(language, namespace, (error, data) => (error ? reject(error) : resolve(data)));
  });

const setup = (bundles: Record<string, TranslifyBundle>, namespaces: readonly string[] = ['cart']) => {
  const fake = fakeClient(bundles);
  const store = fakeStore();
  const events: ClientEvent[] = [];
  const backend = createBackend(fake.client, namespaces, { onEvent: (event) => events.push(event), now: () => 0, clock: () => 7 });
  init(backend, store);
  return { ...fake, store, events, backend };
};

const itIT: TranslifyBundle = { 'cart.cartTitle': 'Il tuo carrello', 'cart.checkout': 'Paga', 'common.ok': 'OK' };

describe('stripNamespace', () => {
  it('drops the namespace prefix the delivery endpoint puts on every key', () => {
    expect(stripNamespace({ 'cart.cartTitle': 'Your cart', 'cart.checkout': 'Checkout' }, 'cart')).toEqual({
      cartTitle: 'Your cart',
      checkout: 'Checkout',
    });
  });

  it('ignores keys from another namespace instead of mis-filing them', () => {
    expect(stripNamespace({ 'cart.cartTitle': 'Your cart', 'common.appName': 'Acme' }, 'cart')).toEqual({ cartTitle: 'Your cart' });
  });
});

describe('createBackend().read', () => {
  it('loads the language through the client and resolves the stripped namespace', async () => {
    const { backend, client, events } = setup({ 'it-IT': itIT });

    expect(await read(backend, 'it-IT', 'cart')).toEqual({ cartTitle: 'Il tuo carrello', checkout: 'Paga' });
    expect(client.load).toHaveBeenCalledWith('it-IT');
    expect(events).toEqual([{ kind: 'loaded', locale: 'it-IT', keys: 3, ms: 0, at: 7 }]);
  });

  it('serves a second namespace of the same language from another load call (the client dedupes)', async () => {
    const { backend, client } = setup({ 'it-IT': itIT }, ['cart', 'common']);

    await read(backend, 'it-IT', 'cart');
    expect(await read(backend, 'it-IT', 'common')).toEqual({ ok: 'OK' });
    expect(client.load).toHaveBeenCalledTimes(2);
  });

  it('emits one loaded row per language, not one per namespace, while the bundle identity is the same', async () => {
    const { backend, events, set } = setup({ 'it-IT': itIT }, ['cart', 'common']);

    await read(backend, 'it-IT', 'cart');
    await read(backend, 'it-IT', 'common');
    expect(events.filter((event) => event.kind === 'loaded')).toHaveLength(1);

    set('it-IT', { 'cart.cartTitle': 'Carrello', 'common.ok': 'OK' });
    await read(backend, 'it-IT', 'cart');
    expect(events.filter((event) => event.kind === 'loaded')).toHaveLength(2);
  });

  it('hands a rejected load to i18next as the TranslifyError and records a load error', async () => {
    const { backend, events } = setup({});

    await expect(read(backend, 'de-DE', 'cart')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(events).toEqual([
      { kind: 'error', locale: 'de-DE', phase: 'load', code: 'NOT_FOUND', status: 404, message: 'nothing published', at: 7 },
    ]);
  });

  it('tells i18next not to retry', async () => {
    const { backend } = setup({});
    const callback = vi.fn();
    backend.read('de-DE', 'cart', callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());
    expect(callback.mock.calls[0]?.[1]).toBe(false);
  });
});

describe('createBackend() live updates', () => {
  it('writes nothing and emits no change for the first bundle: read already delivered it', async () => {
    const { backend, store, events } = setup({ 'it-IT': itIT });

    await read(backend, 'it-IT', 'cart');

    expect(store.removeResourceBundle).not.toHaveBeenCalled();
    expect(store.addResourceBundle).not.toHaveBeenCalled();
    expect(events.map((event) => event.kind)).toEqual(['loaded']);
  });

  it('replaces the namespace in the store and emits changed when the client holds a new bundle', async () => {
    const { backend, store, events, set } = setup({ 'it-IT': itIT });
    await read(backend, 'it-IT', 'cart');

    set('it-IT', { 'cart.cartTitle': 'Carrello' });

    expect(store.removeResourceBundle).toHaveBeenCalledExactlyOnceWith('it-IT', 'cart');
    expect(store.addResourceBundle).toHaveBeenCalledExactlyOnceWith('it-IT', 'cart', { cartTitle: 'Carrello' });
    expect(store.removeResourceBundle.mock.invocationCallOrder[0]!).toBeLessThan(store.addResourceBundle.mock.invocationCallOrder[0]!);
    expect(events.at(-1)).toEqual({ kind: 'changed', locale: 'it-IT', keys: 1, at: 7 });
  });

  it('writes nothing when notified with the same bundle identity', async () => {
    const { backend, store, events, notify } = setup({ 'it-IT': itIT });
    await read(backend, 'it-IT', 'cart');

    notify();

    expect(store.addResourceBundle).not.toHaveBeenCalled();
    expect(events.map((event) => event.kind)).toEqual(['loaded']);
  });

  it('ignores a language i18next never asked for', () => {
    const { store, events, set } = setup({ 'it-IT': itIT });

    set('it-IT', { 'cart.cartTitle': 'Carrello' });

    expect(store.addResourceBundle).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('replaces every configured namespace and emits one change', async () => {
    const { backend, store, events, set } = setup({ 'it-IT': itIT }, ['cart', 'common']);
    await read(backend, 'it-IT', 'cart');

    set('it-IT', { 'cart.cartTitle': 'Carrello', 'common.ok': 'Va bene' });

    expect(store.removeResourceBundle.mock.calls).toEqual([
      ['it-IT', 'cart'],
      ['it-IT', 'common'],
    ]);
    expect(store.addResourceBundle.mock.calls).toEqual([
      ['it-IT', 'cart', { cartTitle: 'Carrello' }],
      ['it-IT', 'common', { ok: 'Va bene' }],
    ]);
    expect(events.filter((event) => event.kind === 'changed')).toHaveLength(1);
  });
});
