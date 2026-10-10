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
 * Below this, a response almost certainly came from the browser's HTTP cache.
 * A heuristic, not a measurement: Resource Timing is unavailable cross-origin
 * without `Timing-Allow-Origin`, which the backend does not send.
 */
export const CACHE_MS_THRESHOLD = 5;

export interface ExchangeInput {
  label: string;
  path: string;
  ms: number;
  status?: number;
  body?: unknown;
  error?: unknown;
}

export const toExchange = (input: ExchangeInput): DeliveryExchange => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  label: input.label,
  path: input.path,
  ms: input.ms,
  source: input.ms < CACHE_MS_THRESHOLD ? 'likely-cache' : 'network',
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
    const response = await fetch(`${config.baseUrl}${requestPath}`, {
      cache: params.cache ?? 'default',
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
