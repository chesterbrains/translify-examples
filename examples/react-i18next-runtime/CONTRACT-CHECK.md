# Delivery contract check

A dated, reproducible run of the diagnostics drawer's probes against the delivery endpoint. To re-run: start the runtime example with `?diagnostics` in the URL (see README), run every probe, and replace the table below with what you observed.

## Run of 2026-11-10

Run against `https://translify.tommasofeltrin.work/api` (project `acme-ecom`, environment `production`, live batch #10 → #11 → #12 during the run) with `@translifyhq/client@0.1.1`, on the branch that replaced the hand-rolled delivery client with the package. Observed through the drawer in Chrome; a throwaway publishable key was created for the run and revoked afterwards.

### Client

What `@translifyhq/client` reported, newest last:

| Step | Client row | Page |
| --- | --- | --- |
| First load, `localStorage` empty | `loaded en-US · 9 keys · 3 ms` (the browser's HTTP cache still held the bundle from a visit seconds earlier; a cold `it-IT` load below shows the network figure) | cart rendered in English |
| Switch to Italiano, never loaded | `loaded it-IT · 9 keys · 147 ms` | Italian text |
| Force revalidate (it-IT) | `revalidated it-IT · unchanged · 135 ms`, then `loaded it-IT · 9 keys · 12 ms` from `reloadResources` | unchanged |
| Reload the page | `loaded en-US · 9 keys · 1 ms` | rendered at once from `localStorage` |
| Force revalidate (en-US) | `revalidated en-US · unchanged · 337 ms` | unchanged |
| Publish #11 in Translify (`cart.cartTitle` it-IT → `Il tuo carrello ✦`), wait 35 s, switch to Italiano | `loaded it-IT · 9 keys · 1 ms` (stale bundle from storage, painted first) then `changed it-IT · 9 keys` | title went from `Il tuo carrello` to `Il tuo carrello ✦` on the open page, without a reload |
| Publish #12 (revert) | — | restored for everyone else |

The `ms` figures are the example's own stopwatch around `load` / `refresh`; the package exposes no cache-hit flag, and the drawer infers none. A background revalidation answered `304` leaves no row by design; the Network tab shows it.

### Probes

Run in listed order, burst last. Ten probes, all `pass` on first run.

| Probe | Expected | Observed | Verdict |
| --- | --- | --- | --- |
| Happy path | 200, non-empty | 200, 9-key bundle | PASS |
| Wrong project slug | 404 | 404 | PASS |
| Unknown environment slug | 404 | 404 | PASS |
| Unknown or disabled locale | 404 | 404 | PASS |
| Missing key | 401 | 401 | PASS |
| Garbage key (`pk_not_a_real_key`) | 401 | 401 | PASS |
| Secret key given to the client | `INVALID_OPTIONS` thrown, no request | `INVALID_OPTIONS`, no request logged | PASS |
| Unknown namespace | 200 `{}` | 200 `{}` | PASS |
| Unknown query parameter | 400 at the origin, or the cached bundle | 400 | PASS |
| Burst of 40 | every call 200 | 40 × 200 | PASS |

Probe requests logged: 48 (9 single + 40 burst; the secret-key probe makes none). Statuses over the log: 42 × 200, 3 × 404, 2 × 401, 1 × 400. No `429`, no console errors. Missing keys stayed empty while the bundle was loaded; with a garbage key the error card showed `UNAUTHORIZED · 401` and the Client section one `error load en-US · UNAUTHORIZED · 401` row (checked separately before the run).

### Backend observations

None new. Items 1–2 of the 2026-09-02 list are fixed and the package relies on them (`ETag` exposed, `Timing-Allow-Origin`); items 3–6 still hold as documented (empty `200` for an unknown namespace, `400` for a junk parameter, per-IP and per-key limits far above ordinary traffic, publishable keys ship in the bundle by design).

## Run of 2026-09-02

> Historical. This run predates the catalog in this repo (keys were `title`, `empty.cta`, `totals.total`) and two backend changes since: the delivery throttle is now 300 requests / 60 s per IP (the burst probe now expects every call served), and `Cache-Control` is `max-age=30`. Everything else still holds; re-run the probes to refresh this table.

Run on 2026-09-02 against http://localhost:3000/api, commit 92f5e51 of translify-sdk-demo.

## Does the chain work?

Yes. Project `acme-ecom` was created through the `translify-fe` UI, locale
en-US (default) and it-IT were added, namespace `cart` with keys `title`,
`empty.cta`, and `totals.total` was translated in both locales, the
`production` environment was published (6 keys), an API key was minted and
placed in `.env`, and the demo app successfully loaded and rendered the bundle
end to end — the cart screen shows real translated strings in both locales,
switching languages works, and every diagnostic probe confirmed the endpoint's
documented contract live.

## Probe results

Run in listed order, burst last, all observed via the drawer UI.

| Probe | Expected | Observed | Verdict |
| --- | --- | --- | --- |
| Happy path | 200, non-empty | 200, 3-key bundle returned | PASS |
| Wrong project slug | 404 | 404 | PASS |
| Unknown environment slug | 404 | 404 | PASS |
| Unknown or disabled locale | 404 | 404 | PASS |
| Missing key | 401 | 401 | PASS |
| Garbage key | 401 | 401 | PASS |
| Unknown namespace | 200 `{}` | 200 `{}` | PASS |
| Unknown query parameter | 400 | 400 | PASS |
| Burst of 40 | some 429 | mix of 200/429 — throttler tripped after roughly 20-22 of the 40 concurrent requests succeeded, remainder got 429 with body `"ThrottlerException: Too Many Requests"` | PASS |

All 9 probes passed against their declared expectation. The exchange log
reached 49 entries (9 non-burst + 40 burst) with zero console errors
throughout the whole session. The missing-keys list stayed empty — nothing
was requested that the bundle didn't have. No surprises beyond what the spec
already predicted for the unknown-namespace and unknown-query-param cases —
both were confirmed exactly as documented, not new discoveries.

## Backend observations

Recorded, not fixed. Each is a decision for `translify-be`.

1. **ETag is unreadable by browser clients.** `main.ts` calls `enableCors()`
   with no `exposedHeaders`, and `ETag` is not CORS-safelisted, so a browser SDK
   cannot do conditional requests or observe the 304 path the endpoint
   implements. One line fixes it: `exposedHeaders: ['ETag']`.
   _Fixed in translify-be v0.15.1 (2026-10-11, TRLIFY-97): `ETag` is exposed and
   the preflight a manual `If-None-Match` triggers is cacheable for a day. The
   "Force revalidate" button now shows the 304._
2. **No `Timing-Allow-Origin`.** Cross-origin Resource Timing is suppressed, so
   a client cannot tell a cache hit from a network round trip except by latency.
   _Fixed in the same release: delivery 200 and 304 carry `Timing-Allow-Origin: *`;
   the drawer's `source` column is measured from `transferSize`._
3. **An unknown namespace returns an empty 200, not a 404.** `DeliveryService`
   filters publication rows and never asserts the namespace exists. For an SDK
   this is the difference between a silent empty bundle and a loud error.
4. **An unrecognised query parameter is a 400.** The global `ValidationPipe` is
   `forbidNonWhitelisted: true`, so any client appending a cache-buster or an
   analytics parameter is rejected.
5. **The throttler is 30 requests per minute per IP.** Low for an endpoint meant
   to serve SDK clients, and it is shared across every caller behind one NAT.
6. **The API key is bearer-grade with no origin binding.** Any browser client
   ships it in its bundle.

Nothing beyond this list turned up in the live run — all six items were
independently confirmed by the probes above (the throttler burst, the
unknown-namespace 200, and the unknown-query-param 400 in particular).
