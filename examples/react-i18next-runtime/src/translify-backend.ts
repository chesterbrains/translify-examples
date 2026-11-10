import type { BackendModule, InitOptions, ReadCallback, Services } from 'i18next';
import type { TranslifyBundle, TranslifyClient } from '@translifyhq/client';
import { toErrorEvent, type ClientEvent } from './diagnostics/client-events';

/**
 * The two store methods i18next exposes at runtime but its `ResourceStore` typing omits.
 * `addResourceBundle` emits `added`, which both react-i18next and the ICU plugin bind to.
 */
export interface ResourceWriter {
  addResourceBundle(lng: string, ns: string, resources: Record<string, string>): unknown;
  removeResourceBundle(lng: string, ns: string): unknown;
}

export interface BackendHooks {
  /** Every fact the client lets us observe; the diagnostics drawer listens, the app ignores it. */
  onEvent?: (event: ClientEvent) => void;
  /** Stopwatch for `ms`. Default `performance.now`. */
  now?: () => number;
  /** Wall clock for `at`. Default `Date.now`. */
  clock?: () => number;
}

/**
 * The delivery endpoint names every key `<namespace>.<keyName>`. i18next wants the bare key
 * inside the namespace, so the prefix goes; a key from any other namespace is dropped rather
 * than mis-filed.
 */
export const stripNamespace = (bundle: Readonly<Record<string, string>>, namespace: string): Record<string, string> => {
  const prefix = `${namespace}.`;

  return Object.fromEntries(
    Object.entries(bundle)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
};

/**
 * An i18next backend over one `@translifyhq/client` instance. This is the whole integration:
 *
 * - `read(language, namespace)` is `client.load(language)` plus `stripNamespace`. The client
 *   was built with `namespaces` = i18next's `ns`, so one `load` fetches every namespace once
 *   (from memory or `localStorage` first, revalidated in the background) and the second
 *   namespace of the same language finds the bundle already in memory.
 * - `subscribe` is where stale-while-revalidate reaches the screen: when a background
 *   revalidation (or `refresh`) brings a new bundle, the namespace is replaced in i18next's
 *   store. `addResourceBundle` emits `added`; react-i18next (`react.bindI18nStore`) and
 *   i18next-icu (`bindI18nStore`) both listen to it, so every `useTranslation` re-renders with
 *   the new text. Replace, not merge: a key the publish removed must not linger.
 */
export const createBackend = (
  client: TranslifyClient,
  namespaces: readonly string[],
  hooks: BackendHooks = {},
): BackendModule => {
  const emit = hooks.onEvent ?? ((): void => undefined);
  const now = hooks.now ?? ((): number => performance.now());
  const clock = hooks.clock ?? Date.now;

  /** Languages i18next asked for: the only ones worth mirroring into the store. */
  const languages = new Set<string>();
  /** The bundle identity last mirrored per language; the client keeps identity until content changes. */
  const lastSeen = new Map<string, TranslifyBundle>();
  /** The bundle identity last reported as `loaded` per language: one row per load, not one per namespace. */
  const lastLoaded = new Map<string, TranslifyBundle>();

  const mirror = (store: ResourceWriter): void => {
    for (const language of languages) {
      const bundle = client.bundle(language);
      if (bundle === undefined || bundle === lastSeen.get(language)) continue;
      // The first bundle reaches i18next through `read`'s callback; only later ones are pushed.
      if (lastSeen.has(language)) {
        for (const namespace of namespaces) {
          store.removeResourceBundle(language, namespace);
          store.addResourceBundle(language, namespace, stripNamespace(bundle, namespace));
        }
        emit({ kind: 'changed', locale: language, keys: Object.keys(bundle).length, at: clock() });
      }
      lastSeen.set(language, bundle);
    }
  };

  return {
    type: 'backend',
    init(services: Services, _backendOptions: unknown, _i18nextOptions: InitOptions): void {
      const store = services.resourceStore as unknown as ResourceWriter;
      client.subscribe(() => mirror(store));
    },
    read(language: string, namespace: string, callback: ReadCallback): void {
      languages.add(language);
      const started = now();
      client
        .load(language)
        .then((bundle) => {
          if (lastLoaded.get(language) !== bundle) {
            lastLoaded.set(language, bundle);
            emit({ kind: 'loaded', locale: language, keys: Object.keys(bundle).length, ms: now() - started, at: clock() });
          }
          if (!lastSeen.has(language)) lastSeen.set(language, bundle);
          callback(null, stripNamespace(bundle, namespace));
        })
        .catch((error: unknown) => {
          emit(toErrorEvent(error, 'load', language, clock()));
          // `false` tells i18next not to retry: the client already applied its own policy.
          callback(error instanceof Error ? error : new Error(String(error)), false);
        });
    },
  };
};
