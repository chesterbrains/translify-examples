import { describe, expect, it } from 'vitest';
import type { DeliveryExchange } from '../translify/types';
import { anyStatus, isEmptyBundle, isHttp, isNonEmptyBundle, PROBES, verdictOf } from './probes';

const exchange = (status: number, body: unknown = {}): DeliveryExchange => ({
  id: 'x',
  at: 0,
  label: 'probe',
  path: '/delivery/a/b/c',
  ms: 10,
  source: 'network',
  outcome: { kind: 'http', status, body },
});

const networkExchange: DeliveryExchange = {
  id: 'y',
  at: 0,
  label: 'probe',
  path: '/delivery/a/b/c',
  ms: 2,
  source: 'likely-cache',
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
    expect(verdictOf(probe, [exchange(404)])).toBe('pass');
  });

  it('fails when it does not', () => {
    expect(verdictOf(probe, [exchange(200)])).toBe('fail');
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
      'unknown-namespace',
      'unknown-query-param',
      'burst',
    ]);
  });
});

describe('unknown-query-param probe', () => {
  const probe = PROBES.find((entry) => entry.id === 'unknown-query-param')!;

  it('passes on the origin 400', () => {
    expect(verdictOf(probe, [exchange(400)])).toBe('pass');
  });

  it('passes on the bundle the edge serves once junk parameters collapse onto the cached entry', () => {
    expect(verdictOf(probe, [exchange(200, { 'common.ok': 'OK' })])).toBe('pass');
  });

  it('still fails on anything else', () => {
    expect(verdictOf(probe, [exchange(401)])).toBe('fail');
  });
});
