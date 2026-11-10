import type { TranslifyConfig } from '../config';
import { appendExchange } from './exchange-log';

/** What came back. A network outcome carries no status — the browser never saw one. */
export type ExchangeOutcome =
  | { kind: 'http'; status: number; body: unknown }
  | { kind: 'network'; message: string };

/** One recorded probe call against the delivery endpoint. */
export interface DeliveryExchange {
  id: string;
  at: number;
  /** Who made the call: a probe's label. */
  label: string;
  /** Path plus query, without the base URL. Never carries the raw key. */
  path: string;
  ms: number;
  /** The response's validator, when the response carried one (delivery exposes `ETag` over CORS). */
  etag?: string;
  outcome: ExchangeOutcome;
}

export interface RawFetchParams {
  locale: string;
  label: string;
  namespace?: string;
  /** Overrides exist so probes can aim at deliberately wrong targets. */
  projectSlug?: string;
  envSlug?: string;
  /** `null` omits the key entirely; `undefined` uses the configured key. */
  apiKey?: string | null;
  extraQuery?: Record<string, string>;
}

/** `key`, when given, is appended as `key=` — the delivery contract since edge caching. */
export const buildDeliveryPath = (config: TranslifyConfig, params: RawFetchParams, key?: string): string => {
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

export interface ExchangeInput {
  label: string;
  path: string;
  ms: number;
  status?: number;
  body?: unknown;
  error?: unknown;
  etag?: string;
}

export const toExchange = (input: ExchangeInput): DeliveryExchange => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  label: input.label,
  path: input.path,
  ms: input.ms,
  ...(input.etag === undefined ? {} : { etag: input.etag }),
  outcome:
    input.status === undefined
      ? { kind: 'network', message: input.error instanceof Error ? input.error.message : String(input.error) }
      : { kind: 'http', status: input.status, body: input.body },
});

/**
 * The probes' own `fetch`: it exists so the drawer can aim requests at deliberately wrong
 * targets (a missing key, a wrong slug, junk query parameters) that `@translifyhq/client`
 * gives no way to send. It never reads the browser cache (`cache: 'reload'`), never sends
 * a conditional header, and never caches anything itself: the application's traffic goes
 * through the package, not through here.
 */
export const rawFetch = async (config: TranslifyConfig, params: RawFetchParams): Promise<DeliveryExchange> => {
  const key = params.apiKey === undefined ? config.apiKey : params.apiKey;
  // The key travels in the URL: the edge cache keys on it, and a request with no custom
  // header needs no CORS preflight.
  const requestPath = buildDeliveryPath(config, params, key ?? undefined);
  const path = buildDeliveryPath(config, params);
  const shownPath = key === null ? path : withKey(path, maskKey(key));

  const started = performance.now();
  let exchange: DeliveryExchange;

  try {
    const response = await fetch(`${config.baseUrl}${requestPath}`, { cache: 'reload' });
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
    });
  } catch (error) {
    // A CORS rejection and a dead server are indistinguishable here: both are a
    // TypeError with no status. The drawer says so rather than guessing.
    exchange = toExchange({ label: params.label, path: shownPath, ms: performance.now() - started, error });
  }

  appendExchange(exchange);

  return exchange;
};
