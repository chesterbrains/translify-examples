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
  /** `null` omits the header entirely; `undefined` uses the configured key. */
  apiKey?: string | null;
  extraQuery?: Record<string, string>;
  cache?: RequestCache;
}

export const buildDeliveryPath = (config: TranslifyConfig, params: FetchParams): string => {
  const projectSlug = params.projectSlug ?? config.projectSlug;
  const envSlug = params.envSlug ?? config.envSlug;
  const query = new URLSearchParams(params.extraQuery ?? {});
  if (params.namespace !== undefined) query.set('namespace', params.namespace);
  const suffix = query.size === 0 ? '' : `?${query.toString()}`;

  return `/delivery/${projectSlug}/${envSlug}/${params.locale}${suffix}`;
};

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
  const path = buildDeliveryPath(config, params);
  const headers: Record<string, string> = {};
  const key = params.apiKey === undefined ? config.apiKey : params.apiKey;
  if (key !== null) headers['X-Api-Key'] = key;

  const started = performance.now();
  let exchange: DeliveryExchange;

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers,
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
      path,
      ms: performance.now() - started,
      status: response.status,
      body,
    });
  } catch (error) {
    // A CORS rejection and a dead server are indistinguishable here: both are a
    // TypeError with no status. The drawer says so rather than guessing.
    exchange = toExchange({
      label: params.label,
      path,
      ms: performance.now() - started,
      error,
    });
  }

  appendExchange(exchange);

  return exchange;
};
