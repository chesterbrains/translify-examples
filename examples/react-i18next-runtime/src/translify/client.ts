import type { DeliveryExchange, TranslifyConfig } from './types';
import { appendExchange } from '../diagnostics/exchange-log';

export interface FetchParams {
  locale: string;
  /** Who is calling: `app: it-IT`, or a probe's label. */
  label: string;
  namespace?: string;
  /** Overrides exist so probes can aim at deliberately wrong targets. */
  projectSlug?: string;
  envSlug?: string;
  /** `null` omits the key entirely; `undefined` uses the configured key. */
  apiKey?: string | null;
  extraQuery?: Record<string, string>;
  cache?: RequestCache;
  /**
   * Sent as `If-None-Match`. The header is not CORS-safelisted, so the browser
   * preflights the request (delivery lets it cache that preflight for a day), and
   * the fetch spec turns a request with a conditional header into `no-store`: the
   * server, not the browser cache, answers, with a 304 when the validator matches.
   */
  ifNoneMatch?: string;
}

/** `key`, when given, is appended as `key=` — the delivery contract since edge caching. */
export const buildDeliveryPath = (config: TranslifyConfig, params: FetchParams, key?: string): string => {
  const projectSlug = params.projectSlug ?? config.projectSlug;
  const envSlug = params.envSlug ?? config.envSlug;
  const query = new URLSearchParams(params.extraQuery ?? {});
  if (params.namespace !== undefined) query.set('namespace', params.namespace);
  if (key !== undefined) query.set('key', key);
  const suffix = query.size === 0 ? '' : `?${query.toString()}`;

  return `/delivery/${projectSlug}/${envSlug}/${params.locale}${suffix}`;
};

/** Shows which key was used without showing the key. */
export const maskKey = (key: string): string => `${'•'.repeat(8)}${key.slice(-4)}`;

/**
 * Appends an already-masked key as `key=` to a path for display. It is not encoded:
 * URLSearchParams would turn the mask's bullets into percent escapes. Requests put the
 * real key in through buildDeliveryPath.
 */
export const withKey = (path: string, maskedKey: string): string =>
  `${path}${path.includes('?') ? '&' : '?'}key=${maskedKey}`;

/**
 * Latency fallback, used only when Resource Timing has no entry for the request:
 * below this, a response almost certainly came from the browser's HTTP cache.
 */
export const CACHE_MS_THRESHOLD = 5;

/**
 * `transferSize` of the request's Resource Timing entry, when the browser recorded one.
 * It is only non-zero cross-origin because delivery sends `Timing-Allow-Origin: *`; a
 * cache hit reports 0. The entry is queued when the fetch completes, so it may not be
 * there yet right after the body is read — hence the fallback.
 */
export const measuredTransferSize = (url: string): number | undefined => {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return undefined;
  const entry = performance.getEntriesByName(url, 'resource').at(-1);

  return entry !== undefined && 'transferSize' in entry ? (entry as PerformanceResourceTiming).transferSize : undefined;
};

export interface ExchangeInput {
  label: string;
  path: string;
  ms: number;
  status?: number;
  body?: unknown;
  error?: unknown;
  etag?: string;
  transferSize?: number;
}

const sourceOf = (input: ExchangeInput): DeliveryExchange['source'] => {
  if (input.transferSize !== undefined) return input.transferSize === 0 ? 'cache' : 'network';

  return input.ms < CACHE_MS_THRESHOLD ? 'likely-cache' : 'network';
};

export const toExchange = (input: ExchangeInput): DeliveryExchange => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  label: input.label,
  path: input.path,
  ms: input.ms,
  source: sourceOf(input),
  ...(input.etag === undefined ? {} : { etag: input.etag }),
  outcome:
    input.status === undefined
      ? { kind: 'network', message: input.error instanceof Error ? input.error.message : String(input.error) }
      : { kind: 'http', status: input.status, body: input.body },
});

/**
 * The only code in the demo that talks to the delivery endpoint. Every call is
 * logged, so the diagnostics drawer sees real application traffic.
 */
export const fetchBundle = async (
  config: TranslifyConfig,
  params: FetchParams,
): Promise<DeliveryExchange> => {
  const key = params.apiKey === undefined ? config.apiKey : params.apiKey;
  // Since edge caching the key travels in the URL: the edge cache keys on it, and a
  // request with no custom header needs no CORS preflight.
  const requestPath = buildDeliveryPath(config, params, key ?? undefined);
  // The drawer shows `path`; it must never carry the raw key.
  const path = buildDeliveryPath(config, params);
  const shownPath = key === null ? path : withKey(path, maskKey(key));

  const started = performance.now();
  let exchange: DeliveryExchange;

  try {
    const url = `${config.baseUrl}${requestPath}`;
    const response = await fetch(url, {
      cache: params.cache ?? 'default',
      headers: params.ifNoneMatch === undefined ? {} : { 'If-None-Match': params.ifNoneMatch },
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      // A non-JSON body is itself worth seeing in the drawer; keep the raw text.
    }
    exchange = toExchange({
      label: params.label,
      path: shownPath,
      ms: performance.now() - started,
      status: response.status,
      body,
      etag: response.headers.get('etag') ?? undefined,
      transferSize: measuredTransferSize(url),
    });
  } catch (error) {
    // A CORS rejection and a dead server are indistinguishable here: both are a
    // TypeError with no status. The drawer says so rather than guessing.
    exchange = toExchange({
      label: params.label,
      path: shownPath,
      ms: performance.now() - started,
      error,
    });
  }

  appendExchange(exchange);

  return exchange;
};
