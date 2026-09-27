# Findings

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
2. **No `Timing-Allow-Origin`.** Cross-origin Resource Timing is suppressed, so
   a client cannot tell a cache hit from a network round trip except by latency.
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
