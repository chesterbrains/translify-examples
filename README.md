# translify-sdk-demo

A small consumer of the Translify delivery endpoint, built to answer one
question: does a project created in `translify-fe` and published to an
environment actually reach an outside client?

It renders a cart screen through i18next from a published bundle, and carries a
diagnostics drawer that probes the endpoint's failure modes against declared
expectations.

## Setup

```sh
pnpm install
cp .env.example .env   # fill in a real API key
pnpm dev
```

The app needs data that already exists: project `acme-ecom`, environment
`production` (published), locales `en-US` and `it-IT`, and namespace `cart`
with the keys `title`, `empty.cta`, `totals.total`. Create them through the
`translify-fe` UI first.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on http://localhost:5173 |
| `pnpm build` | Type-check then build |
| `pnpm test` | Vitest over the pure modules |

Tests cover configuration validation, exchange construction, and probe
verdicts. The delivery endpoint is never mocked — the probes run live, which is
the entire point.

## Results

See `FINDINGS.md`.
