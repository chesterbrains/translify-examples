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
 * Loads one locale's whole published bundle as i18next's single namespace.
 * The delivery `?namespace=` filter is exercised by the probes, not here.
 */
export const createBackend = (config: TranslifyConfig): BackendModule => ({
  type: 'backend',
  init(_services: Services, _backendOptions: unknown, _i18nextOptions: InitOptions): void {
    // Nothing to set up: the client is configured by closure.
  },
  read(language: string, _namespace: string, callback: ReadCallback): void {
    void fetchBundle(config, {
      locale: language,
      label: `app: ${language}`,
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
      callback(null, exchange.outcome.body);
    });
  },
});
