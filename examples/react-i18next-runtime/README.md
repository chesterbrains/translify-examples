# Runtime example — React + i18next on `@translifyhq/client`

The app fetches its published translations from Translify at runtime through [`@translifyhq/client`](https://github.com/chesterbrains/translify-js), behind a small i18next backend. Publish in Translify and the open page updates on its next revalidation; a reload renders from `localStorage` at once.

```
browser ──@translifyhq/client──▶ GET /api/delivery/acme-ecom/production/it-IT?namespace=cart&key=pk_… ──▶ Translify (edge-cached)
        ◀── { "cart.cartTitle": "Il tuo carrello", … }   cached, revalidated with ETag, pushed into i18next
```

## Run it

Seed the project first ([root README](../../README.md), steps 1–3). Then:

```sh
cp .env.example .env     # then fill it in, see below
pnpm install
pnpm dev                 # http://localhost:5173
```

`.env`:

```
VITE_TRANSLIFY_API_KEY=pk_…                                   # delivery key: project → API keys → New key → Publishable
VITE_TRANSLIFY_BASE_URL=https://translify.tommasofeltrin.work/api
VITE_TRANSLIFY_PROJECT_SLUG=acme-ecom
VITE_TRANSLIFY_ENV_SLUG=production
VITE_TRANSLIFY_LOCALES=en-US,it-IT
```

A **publishable key** (`pk_…`) is not a secret key: it only reads published bundles of one project, it is meant to ship in a browser bundle, and you revoke it in Translify. Secret keys (`sk_…`) never belong in a frontend; the client refuses one before making any request.

## The integration (all of it)

One client, built once in `src/main.tsx`:

```ts
import { createTranslify, localStorageStorage } from '@translifyhq/client';

const client = createTranslify({
  baseUrl: config.baseUrl,          // required, no default: the API hostname is yours to pin
  project: config.projectSlug,
  environment: config.envSlug,
  key: config.apiKey,               // pk_…
  namespaces: [...NAMESPACES],      // i18next's `ns`, 1:1 with Translify namespaces
  storage: localStorageStorage(),   // second page load renders from the cached bundle at once
  onError: (error) => appendClientEvent(toErrorEvent(error, 'revalidate')), // background failures
});
```

One i18next backend module over it, `src/translify-backend.ts`:

```ts
import type { BackendModule, InitOptions, ReadCallback, Services } from 'i18next';
import type { TranslifyBundle, TranslifyClient } from '@translifyhq/client';

/** Delivery names every key `<namespace>.<keyName>`; i18next wants the bare key inside the namespace. */
export const stripNamespace = (bundle: Readonly<Record<string, string>>, namespace: string): Record<string, string> => {
  const prefix = `${namespace}.`;

  return Object.fromEntries(
    Object.entries(bundle)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
};

/** i18next's store exposes these at runtime; its `ResourceStore` typing omits them. */
interface ResourceWriter {
  addResourceBundle(lng: string, ns: string, resources: Record<string, string>): unknown;
  removeResourceBundle(lng: string, ns: string): unknown;
}

export const createBackend = (client: TranslifyClient, namespaces: readonly string[]): BackendModule => {
  const languages = new Set<string>();                 // what i18next asked for
  const lastSeen = new Map<string, TranslifyBundle>(); // bundle identity last mirrored per language

  return {
    type: 'backend',
    init(services: Services, _backendOptions: unknown, _i18nextOptions: InitOptions): void {
      const store = services.resourceStore as unknown as ResourceWriter;
      // Stale-while-revalidate reaches the screen here: a new bundle replaces the namespace in
      // i18next's store; `addResourceBundle` emits `added`, which react-i18next and the ICU
      // plugin both listen to, so every `useTranslation` re-renders with the new text.
      client.subscribe(() => {
        for (const language of languages) {
          const bundle = client.bundle(language);
          if (bundle === undefined || bundle === lastSeen.get(language)) continue;
          if (lastSeen.has(language)) {
            for (const namespace of namespaces) {
              store.removeResourceBundle(language, namespace); // replace, not merge: removed keys go too
              store.addResourceBundle(language, namespace, stripNamespace(bundle, namespace));
            }
          }
          lastSeen.set(language, bundle);
        }
      });
    },
    read(language: string, namespace: string, callback: ReadCallback): void {
      languages.add(language);
      client
        .load(language) // memory or localStorage first, revalidated in the background; one request per namespace otherwise
        .then((bundle) => {
          if (!lastSeen.has(language)) lastSeen.set(language, bundle);
          callback(null, stripNamespace(bundle, namespace));
        })
        .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), false));
    },
  };
};
```

The file in `src/` is this plus the diagnostics events (`loaded`, `changed`, `error`). Wire it up in `src/i18n.ts`:

```ts
i18next
  .use(new ICU({ bindI18nStore: 'added' }))               // drop compiled ICU messages when a namespace is replaced
  .use(createBackend(client, NAMESPACES))
  .use(initReactI18next)
  .init({ ns: [...NAMESPACES], react: { useSuspense: false, bindI18nStore: 'added' }, /* … */ });
```

- i18next's `ns: ['cart']` maps 1:1 to Translify namespaces and is the client's `namespaces` option: one `load(language)` fetches each namespace once and merges them.
- Delivery names keys `cart.cartTitle`; `stripNamespace` makes them `cartTitle` inside the `cart` namespace.
- Plurals and arguments are ICU in Translify (`{count, plural, one {{count} item} other {{count} items}}`), so the app uses `i18next-icu`. The plugin memoises each compiled message per key, so it must hear the same `added` event react-i18next re-renders on; without `bindI18nStore` a publish would re-render the page with the old compiled strings.
- Both caches hear `added`: `react.bindI18nStore` re-renders every `useTranslation`, the ICU plugin drops its compiled messages.
- "Force revalidate" (diagnostics mode) is `client.refresh(language)` followed by `i18n.reloadResources`.
- The client lives as long as the page; nothing calls `dispose()`.

## What the package does for you

- **Caching and revalidation.** Each (locale, namespace) bundle is kept with its `ETag`, served from memory or `localStorage` first, revalidated in the background against that `ETag`. A transient failure (network, 429, 5xx) keeps the cached bundle; a definitive one (key revoked, environment archived) drops it from storage so the next load fails loudly. [Caching →](https://github.com/chesterbrains/translify-js#caching)
- **A sync read and a subscription**, which is what `useSyncExternalStore` and the backend above need. [Using with React →](https://github.com/chesterbrains/translify-js#using-with-react)
- **One error type**, `TranslifyError` with a `code` (`UNAUTHORIZED`, `NOT_FOUND`, `RATE_LIMITED`, …) and a message that never contains the key. The error card in `src/app/delivery-error-card.tsx` speaks in those codes. [Errors →](https://github.com/chesterbrains/translify-js#errors)
- **Typed keys** for apps that read the bundle directly (`npx @translifyhq/client types`). This example lets i18next own typing instead. [Typed keys →](https://github.com/chesterbrains/translify-js#typed-keys)

## What delivery guarantees

- The key travels as `?key=pk_…`; a publishable key is bound to one project and a secret key is refused with `401`.
- Wrong project, environment or locale: `404` with no detail. Missing or revoked key: `401`. Unknown namespace: `200 {}`.
- Rate limits on delivery: 300 requests / 60 s per IP and 6000 / 60 s per key, answered with `429`. Ordinary traffic never meets them; the diagnostics burst of 40 proves it.
- The HTTP details (`Cache-Control`, `ETag`, `304`, preflight caching) are the package's job; the [`/docs` page](https://translify.tommasofeltrin.work/docs) and the package README document them.

## Diagnostics

Open `http://localhost:5173/?diagnostics` (or set `VITE_DIAGNOSTICS=1`) to mount the drawer:

- **Client**: what `@translifyhq/client` reports and nothing more — `loaded <locale> · <n> keys · <ms>`, `changed <locale>` when `subscribe` fires with a new bundle, `revalidated <locale> · changed|unchanged` after Force revalidate, `error load|revalidate · <code> · <status>`. A background revalidation answered with `304` is silent by design; the Network tab shows it.
- **Missing keys**: keys the app asked i18next for and did not get.
- **Probes**: raw requests the package gives no way to send (`src/diagnostics/raw-fetch.ts`, a plain `fetch` with `cache: 'reload'`): wrong slugs, a missing or garbage key, an unknown namespace, a junk query parameter, a burst of 40, plus one that hands the client a secret key and expects `INVALID_OPTIONS` before any request. [`CONTRACT-CHECK.md`](CONTRACT-CHECK.md) is a dated run of those probes.

## Tests

```sh
pnpm test    # vitest: config, translify-backend (fake client + store), i18n (ICU, replace → re-render), revalidate, client-events, raw-fetch, probes, diagnostics flag
pnpm build   # tsc + vite
```

`vite.config.ts` inlines `i18next-icu` and `intl-messageformat` for vitest: `intl-messageformat` ships CJS-first without an `exports` map, and Node's ESM loader would otherwise hand i18next-icu the module object instead of the class. The browser build is unaffected.
