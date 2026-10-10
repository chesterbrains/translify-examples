import type { DeliveryExchange, TranslifyConfig } from '../translify/types';
import { fetchBundle } from '../translify/client';

export type Verdict = 'pass' | 'fail';

export interface Probe {
  id: string;
  label: string;
  /** Human-readable expectation, shown next to the verdict. */
  expectation: string;
  run(config: TranslifyConfig): Promise<DeliveryExchange[]>;
  expect(exchanges: DeliveryExchange[]): boolean;
}

export const isHttp = (exchange: DeliveryExchange, status: number): boolean =>
  exchange.outcome.kind === 'http' && exchange.outcome.status === status;

const bundleSize = (exchange: DeliveryExchange): number | undefined => {
  if (exchange.outcome.kind !== 'http' || exchange.outcome.status !== 200) return undefined;
  const body = exchange.outcome.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;

  return Object.keys(body).length;
};

export const isEmptyBundle = (exchange: DeliveryExchange): boolean => bundleSize(exchange) === 0;

export const isNonEmptyBundle = (exchange: DeliveryExchange): boolean => (bundleSize(exchange) ?? 0) > 0;

export const anyStatus = (exchanges: DeliveryExchange[], status: number): boolean =>
  exchanges.some((exchange) => isHttp(exchange, status));

export const verdictOf = (probe: Probe, exchanges: DeliveryExchange[]): Verdict =>
  probe.expect(exchanges) ? 'pass' : 'fail';

const one = async (
  config: TranslifyConfig,
  label: string,
  overrides: Partial<Parameters<typeof fetchBundle>[1]>,
): Promise<DeliveryExchange[]> => [
  await fetchBundle(config, { locale: config.locales[0]!, label, cache: 'reload', ...overrides }),
];

/**
 * Delivery allows 300 requests per 60 s per IP (6000 per key), so a burst of 40 must be
 * served in full: the probe proves ordinary traffic never meets the throttler. Push it
 * past 300 to watch the 429s instead.
 */
export const BURST_SIZE = 40;

export const PROBES: Probe[] = [
  {
    id: 'happy-path',
    label: 'Happy path',
    expectation: '200 with a non-empty bundle',
    run: (config) => one(config, 'probe: happy path', {}),
    expect: ([exchange]) => exchange !== undefined && isNonEmptyBundle(exchange),
  },
  {
    id: 'wrong-project',
    label: 'Wrong project slug',
    expectation: '404 — slug must match the key, checked before any DB hit',
    run: (config) => one(config, 'probe: wrong project', { projectSlug: 'not-a-project' }),
    expect: ([exchange]) => exchange !== undefined && isHttp(exchange, 404),
  },
  {
    id: 'unknown-env',
    label: 'Unknown environment slug',
    expectation: '404',
    run: (config) => one(config, 'probe: unknown env', { envSlug: 'not-an-env' }),
    expect: ([exchange]) => exchange !== undefined && isHttp(exchange, 404),
  },
  {
    id: 'unknown-locale',
    label: 'Unknown or disabled locale',
    expectation: '404',
    run: (config) => one(config, 'probe: unknown locale', { locale: 'zz-ZZ' }),
    expect: ([exchange]) => exchange !== undefined && isHttp(exchange, 404),
  },
  {
    id: 'missing-key',
    label: 'Missing key',
    expectation: '401',
    run: (config) => one(config, 'probe: missing key', { apiKey: null }),
    expect: ([exchange]) => exchange !== undefined && isHttp(exchange, 401),
  },
  {
    id: 'garbage-key',
    label: 'Garbage key',
    expectation: '401',
    run: (config) => one(config, 'probe: garbage key', { apiKey: 'tlf_live_not_a_real_key' }),
    expect: ([exchange]) => exchange !== undefined && isHttp(exchange, 401),
  },
  {
    id: 'unknown-namespace',
    label: 'Unknown namespace',
    expectation: '200 with {} — the service filters rows and never asserts the namespace exists',
    run: (config) => one(config, 'probe: unknown namespace', { namespace: 'not-a-namespace' }),
    expect: ([exchange]) => exchange !== undefined && isEmptyBundle(exchange),
  },
  {
    id: 'unknown-query-param',
    label: 'Unknown query parameter',
    expectation:
      '400 at the origin (ValidationPipe is forbidNonWhitelisted), or the cached bundle once the edge has one — its cache key ignores unknown parameters on purpose, so junk cannot bypass it',
    run: (config) => one(config, 'probe: unknown query param', { extraQuery: { foo: 'bar' } }),
    expect: ([exchange]) => exchange !== undefined && (isHttp(exchange, 400) || isNonEmptyBundle(exchange)),
  },
  {
    id: 'burst',
    label: `Burst of ${BURST_SIZE} calls`,
    expectation: 'every call served (200) — 40 is under the 300/60 s per-IP delivery limit; run this last',
    run: async (config) =>
      Promise.all(
        Array.from({ length: BURST_SIZE }, (_unused, index) =>
          fetchBundle(config, {
            locale: config.locales[0]!,
            label: `probe: burst ${index + 1}`,
            cache: 'reload',
          }),
        ),
      ),
    expect: (exchanges) => exchanges.length === BURST_SIZE && exchanges.every(isNonEmptyBundle),
  },
];
