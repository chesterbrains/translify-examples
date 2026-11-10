import { describe, expect, it } from 'vitest';
import type { TranslifyConfig } from '../config';
import type { DeliveryExchange } from './raw-fetch';
import { anyStatus, BURST_SIZE, isEmptyBundle, isHttp, isNonEmptyBundle, PROBES, verdictOf, type ProbeResult } from './probes';

const config: TranslifyConfig = {
  baseUrl: 'http://localhost:3000/api',
  projectSlug: 'acme-ecom',
  envSlug: 'production',
  apiKey: 'pk_abc123',
  locales: ['en-US', 'it-IT'],
};

const result = (...exchanges: DeliveryExchange[]): ProbeResult => ({ exchanges });

const exchange = (status: number, body: unknown = {}): DeliveryExchange => ({
  id: 'x',
  at: 0,
  label: 'probe',
  path: '/delivery/a/b/c',
  ms: 10,
  outcome: { kind: 'http', status, body },
});

const networkExchange: DeliveryExchange = {
  id: 'y',
  at: 0,
  label: 'probe',
  path: '/delivery/a/b/c',
  ms: 2,
  outcome: { kind: 'network', message: 'Failed to fetch' },
};

describe('predicates', () => {
  it('matches a status', () => {
    expect(isHttp(exchange(404), 404)).toBe(true);
    expect(isHttp(exchange(200), 404)).toBe(false);
  });

  it('never matches a network outcome', () => {
    expect(isHttp(networkExchange, 404)).toBe(false);
  });

  it('recognises an empty 200 bundle', () => {
    expect(isEmptyBundle(exchange(200, {}))).toBe(true);
    expect(isEmptyBundle(exchange(200, { 'cart.title': 'Cart' }))).toBe(false);
  });

  it('recognises a non-empty 200 bundle', () => {
    expect(isNonEmptyBundle(exchange(200, { 'cart.title': 'Cart' }))).toBe(true);
    expect(isNonEmptyBundle(exchange(404))).toBe(false);
  });

  it('finds a status anywhere in a burst', () => {
    expect(anyStatus([exchange(200), exchange(429)], 429)).toBe(true);
    expect(anyStatus([exchange(200), exchange(200)], 429)).toBe(false);
  });
});

describe('verdictOf', () => {
  const probe = PROBES.find((entry) => entry.id === 'wrong-project')!;

  it('passes when the expectation holds', () => {
    expect(verdictOf(probe, result(exchange(404)))).toBe('pass');
  });

  it('fails when it does not', () => {
    expect(verdictOf(probe, result(exchange(200)))).toBe('fail');
  });
});

describe('PROBES', () => {
  it('has unique ids', () => {
    expect(new Set(PROBES.map((probe) => probe.id)).size).toBe(PROBES.length);
  });

  it('covers every case in the spec', () => {
    expect(PROBES.map((probe) => probe.id)).toEqual([
      'happy-path',
      'wrong-project',
      'unknown-env',
      'unknown-locale',
      'missing-key',
      'garbage-key',
      'secret-key-refused',
      'unknown-namespace',
      'unknown-query-param',
      'burst',
    ]);
  });
});

describe('burst probe', () => {
  const probe = PROBES.find((entry) => entry.id === 'burst')!;

  it('passes when every call in the burst is served: 40 is well under the 300/60 s per-IP limit', () => {
    expect(verdictOf(probe, result(...Array.from({ length: BURST_SIZE }, () => exchange(200, { 'cart.cartTitle': 'x' }))))).toBe('pass');
  });

  it('fails if the throttler trips below its documented limit', () => {
    expect(verdictOf(probe, result(exchange(200, { 'cart.cartTitle': 'x' }), exchange(429)))).toBe('fail');
  });
});

describe('unknown-query-param probe', () => {
  const probe = PROBES.find((entry) => entry.id === 'unknown-query-param')!;

  it('passes on the origin 400', () => {
    expect(verdictOf(probe, result(exchange(400)))).toBe('pass');
  });

  it('passes on the bundle the edge serves once junk parameters collapse onto the cached entry', () => {
    expect(verdictOf(probe, result(exchange(200, { 'common.ok': 'OK' })))).toBe('pass');
  });

  it('still fails on anything else', () => {
    expect(verdictOf(probe, result(exchange(401)))).toBe('fail');
  });
});

describe('secret-key-refused probe', () => {
  const probe = PROBES.find((entry) => entry.id === 'secret-key-refused')!;

  it('passes when the client threw INVALID_OPTIONS and made no request', async () => {
    const outcome = await probe.run(config); // the real createTranslify, no network
    expect(outcome).toEqual({ exchanges: [], note: 'INVALID_OPTIONS' });
    expect(verdictOf(probe, outcome)).toBe('pass');
  });

  it('fails when a request was made or nothing was thrown', () => {
    expect(verdictOf(probe, { exchanges: [exchange(401)], note: 'INVALID_OPTIONS' })).toBe('fail');
    expect(verdictOf(probe, { exchanges: [], note: 'no error thrown' })).toBe('fail');
  });
});
