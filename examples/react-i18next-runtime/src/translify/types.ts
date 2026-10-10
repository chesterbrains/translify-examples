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
   * Heuristic. Cross-origin Resource Timing is unavailable without a
   * `Timing-Allow-Origin` header, which the backend does not send, so cache
   * attribution is inferred from latency alone.
   */
  source: 'network' | 'likely-cache';
  outcome: ExchangeOutcome;
}
