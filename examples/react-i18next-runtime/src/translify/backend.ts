import type { BackendModule, ReadCallback, Services, InitOptions } from 'i18next';
import type { Bundle, TranslifyConfig } from './types';
import { fetchBundle } from './client';

let forceRevalidate = false;

/** Makes the next read bypass the browser's HTTP cache. Driven by the drawer's toggle. */
export const setForceRevalidate = (on: boolean): void => {
  forceRevalidate = on;
};

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
 */
export const createBackend = (config: TranslifyConfig): BackendModule => ({
  type: 'backend',
  init(_services: Services, _backendOptions: unknown, _i18nextOptions: InitOptions): void {
    // Nothing to set up: the client is configured by closure.
  },
  read(language: string, namespace: string, callback: ReadCallback): void {
    void fetchBundle(config, {
      locale: language,
      namespace,
      label: `app: ${language}/${namespace}`,
      cache: forceRevalidate ? 'reload' : 'default',
    }).then((exchange) => {
      if (exchange.outcome.kind === 'network') {
        callback(new Error(`network or CORS failure: ${exchange.outcome.message}`), false);

        return;
      }
      if (exchange.outcome.status !== 200 || !isBundle(exchange.outcome.body)) {
        callback(new Error(`delivery returned ${exchange.outcome.status}`), false);

        return;
      }
      callback(null, stripNamespace(exchange.outcome.body, namespace));
    }).catch((error: unknown) => {
      callback(error instanceof Error ? error : new Error(String(error)), false);
    });
  },
});
