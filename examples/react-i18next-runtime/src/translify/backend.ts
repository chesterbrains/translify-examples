import type { BackendModule, ReadCallback, Services, InitOptions } from 'i18next';
import type { Bundle, TranslifyConfig } from './types';
import { fetchBundle } from './client';

let forceRevalidate = false;

/**
 * Makes the next read ask the server, not the browser cache. Driven by the drawer's
 * toggle. A namespace the backend already holds is revalidated with `If-None-Match`,
 * so the exchange log shows the 304; one it has never seen is fetched with `reload`.
 */
export const setForceRevalidate = (on: boolean): void => {
  forceRevalidate = on;
};

/** What a backend remembers per (language, namespace): the bundle as served and its validator. */
interface HeldBundle {
  etag: string;
  bundle: Bundle;
}

const isBundle = (body: unknown): body is Bundle =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

/**
 * The delivery endpoint names every key `<namespace>.<keyName>`, with or without a
 * `?namespace=` filter. i18next wants the bare key inside the namespace, so the prefix
 * goes; a key from any other namespace is dropped rather than mis-filed.
 */
export const stripNamespace = (bundle: Bundle, namespace: string): Bundle => {
  const prefix = `${namespace}.`;

  return Object.fromEntries(
    Object.entries(bundle)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
};

/**
 * One delivery request per (language, namespace): i18next's `ns` list maps 1:1 to
 * Translify namespaces, and `?namespace=` is the only query parameter delivery takes.
 *
 * An ordinary read is a plain GET and leaves caching to the browser: inside
 * `max-age` it is a cache hit, after it the browser revalidates on its own and hands
 * the page a 200 either way. The backend keeps every bundle it received with its
 * `ETag` so that a forced read can revalidate explicitly and honour the 304 itself —
 * the pattern a client with its own persistent store would use on every read.
 */
export const createBackend = (config: TranslifyConfig): BackendModule => {
  const held = new Map<string, HeldBundle>();

  return {
    type: 'backend',
    init(_services: Services, _backendOptions: unknown, _i18nextOptions: InitOptions): void {
      // Nothing to set up: the client is configured by closure.
    },
    read(language: string, namespace: string, callback: ReadCallback): void {
      const id = `${language}/${namespace}`;
      const previous = held.get(id);
      const revalidate = forceRevalidate && previous !== undefined;

      void fetchBundle(config, {
        locale: language,
        namespace,
        label: `app: ${id}`,
        cache: forceRevalidate && !revalidate ? 'reload' : 'default',
        ...(revalidate ? { ifNoneMatch: previous.etag } : {}),
      })
        .then((exchange) => {
          if (exchange.outcome.kind === 'network') {
            callback(new Error(`network or CORS failure: ${exchange.outcome.message}`), false);

            return;
          }
          if (exchange.outcome.status === 304 && previous !== undefined) {
            callback(null, stripNamespace(previous.bundle, namespace));

            return;
          }
          if (exchange.outcome.status !== 200 || !isBundle(exchange.outcome.body)) {
            callback(new Error(`delivery returned ${exchange.outcome.status}`), false);

            return;
          }
          if (exchange.etag !== undefined) held.set(id, { etag: exchange.etag, bundle: exchange.outcome.body });
          callback(null, stripNamespace(exchange.outcome.body, namespace));
        })
        .catch((error: unknown) => {
          callback(error instanceof Error ? error : new Error(String(error)), false);
        });
    },
  };
};
