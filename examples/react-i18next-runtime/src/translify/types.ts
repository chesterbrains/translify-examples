/** Validated configuration the whole demo runs on. */
export interface TranslifyConfig {
  /** No trailing slash. Includes the backend's `/api` global prefix. */
  baseUrl: string;
  projectSlug: string;
  envSlug: string;
  apiKey: string;
  locales: string[];
}

/** A delivery bundle as served: flat `<namespace>.<keyName>` -> value. */
export type Bundle = Record<string, string>;

/** What came back. A network outcome carries no status — the browser never saw one. */
export type ExchangeOutcome =
  | { kind: 'http'; status: number; body: unknown }
  | { kind: 'network'; message: string };

/** One recorded call through the delivery client. */
export interface DeliveryExchange {
  id: string;
  at: number;
  /** Who made the call: `app: it-IT`, or a probe's label. */
  label: string;
  /** Path plus query, without the base URL. */
  path: string;
  ms: number;
  /**
   * Where the bytes came from. `cache` and `network` are measured: delivery sends
   * `Timing-Allow-Origin: *`, so cross-origin Resource Timing reports `transferSize`
   * (0 for a browser-cache hit, header-sized for a 304). `likely-cache` is the
   * latency fallback for when no timing entry was found.
   */
  source: 'network' | 'cache' | 'likely-cache';
  /** The response's validator. Readable because delivery exposes `ETag` over CORS. */
  etag?: string;
  outcome: ExchangeOutcome;
}
