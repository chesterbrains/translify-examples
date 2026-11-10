import { describe, expect, it, vi } from 'vitest';
import { TranslifyError, type TranslifyBundle, type TranslifyClient } from '@translifyhq/client';
import type { ClientEvent } from '../diagnostics/client-events';
import { revalidate } from './revalidate';

const clientWith = (bundle: TranslifyBundle | undefined, refresh: TranslifyClient['refresh']): TranslifyClient => ({
  load: vi.fn(),
  get: () => undefined,
  bundle: () => bundle,
  subscribe: () => () => undefined,
  refresh,
  dispose: vi.fn(),
});

const run = async (client: TranslifyClient): Promise<{ ok: boolean; events: ClientEvent[] }> => {
  const events: ClientEvent[] = [];
  const ok = await revalidate(client, 'it-IT', (event) => events.push(event), () => 0, () => 7);

  return { ok, events };
};

describe('revalidate', () => {
  const held: TranslifyBundle = { 'cart.cartTitle': 'Il tuo carrello' };

  it('reports a changed bundle when refresh hands back a new identity', async () => {
    const { ok, events } = await run(clientWith(held, vi.fn().mockResolvedValue({ 'cart.cartTitle': 'Carrello' })));

    expect(ok).toBe(true);
    expect(events).toEqual([{ kind: 'revalidated', locale: 'it-IT', changed: true, ms: 0, at: 7 }]);
  });

  it('reports unchanged when refresh hands back the same object (a 304, or identical content)', async () => {
    const { events } = await run(clientWith(held, vi.fn().mockResolvedValue(held)));

    expect(events).toEqual([{ kind: 'revalidated', locale: 'it-IT', changed: false, ms: 0, at: 7 }]);
  });

  it('emits nothing on a failed refresh of a held locale: the client already reported it through onError', async () => {
    const { ok, events } = await run(
      clientWith(held, vi.fn().mockRejectedValue(new TranslifyError('UNAUTHORIZED', 'delivery key refused', 401))),
    );

    expect(ok).toBe(false);
    expect(events).toEqual([]);
  });

  it('emits one load error on a failed refresh of a locale the client does not hold: that path never calls onError', async () => {
    const { ok, events } = await run(
      clientWith(undefined, vi.fn().mockRejectedValue(new TranslifyError('NOT_FOUND', 'nothing published', 404))),
    );

    expect(ok).toBe(false);
    expect(events).toEqual([
      { kind: 'error', locale: 'it-IT', phase: 'load', code: 'NOT_FOUND', status: 404, message: 'nothing published', at: 7 },
    ]);
  });
});
