# Runtime example — React + i18next over the delivery endpoint

The app fetches its published translations from Translify at runtime. Publish in Translify and the next page load shows the new text: no build, no deploy.

```
browser ──GET /api/delivery/acme-ecom/production/it-IT?namespace=cart&key=pk_…──▶ Translify (edge-cached)
        ◀── { "cart.cartTitle": "Il tuo carrello", … }
```

## Run it

Seed the project first ([root README](../../README.md), steps 1–3). Then:

```sh
cp .env.example .env     # set VITE_TRANSLIFY_API_KEY to a delivery key (pk_…)
pnpm install
pnpm dev                 # http://localhost:5173
```

A **delivery key** is not a secret key: it only reads published bundles of one project, it is meant to ship in a browser bundle, and you revoke it in Translify. Secret keys (`sk_…`) never belong in a frontend.

## The integration (all of it)

`src/translify/backend.ts` is an i18next backend module. One delivery request per (language, namespace):

```ts
read(language, namespace, callback) {
  fetchBundle(config, { locale: language, namespace, … }).then((exchange) => {
    …
    callback(null, stripNamespace(exchange.outcome.body, namespace));
  });
}
```

- i18next's `ns: ['cart']` maps 1:1 to Translify namespaces; `?namespace=` is the only query parameter delivery takes.
- Delivery names keys `cart.cartTitle`; `stripNamespace` makes them `cartTitle` inside the `cart` namespace.
- Plurals and arguments are ICU in Translify (`{count, plural, one {{count} item} other {{count} items}}`), so the app uses `i18next-icu`. `src/i18n.ts` holds the options.
- The key travels as `?key=` so the edge cache can key on it and the request needs no CORS preflight.

## What delivery guarantees

- `Cache-Control: public, max-age=60` and an edge cache in front: repeat loads inside a minute come from cache. The "Force revalidate" button (diagnostics mode) bypasses the browser cache.
- An `ETag` is sent, but a browser cannot read it cross-origin yet (it is not in `Access-Control-Expose-Headers`), so conditional requests are not possible from page JavaScript. Tracked as TRLIFY-97.
- Wrong project, environment or locale: `404` with no detail. Missing or revoked key: `401`. Unknown namespace: `200 {}`.
- Rate limit: 30 requests / 60 s per IP across the API. Cache locally and normal traffic stays far below it.

## Diagnostics

Open `http://localhost:5173/?diagnostics` (or set `VITE_DIAGNOSTICS=1`) to mount the drawer: every delivery exchange the app made, a list of keys the app asked for and did not get, and probes that hit the endpoint's failure modes on purpose (wrong slug, bad key, unknown namespace, burst of 40). [`CONTRACT-CHECK.md`](CONTRACT-CHECK.md) is a dated run of those probes.

## Tests

```sh
pnpm test    # vitest: config, client, backend (namespace mapping), i18n (ICU), diagnostics flag, probes
pnpm build   # tsc + vite
```

`vite.config.ts` inlines `i18next-icu` and `intl-messageformat` for vitest: `intl-messageformat` ships CJS-first without an `exports` map, and Node's ESM loader would otherwise hand i18next-icu the module object instead of the class. The browser build is unaffected.
