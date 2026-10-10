# Build-time example — Angular + XLIFF 2.0

`translify pull` writes `src/locale/messages.it-IT.xlf`; `ng build` (with `localize: true`) compiles one bundle per locale from it.

```
CI ──npx translify pull──▶ src/locale/messages.*.xlf ──ng build──▶ dist/angular-xliff/browser/{en-US,it-IT}/
```

## Run it

The pulled files are committed, so this works with no key:

```sh
pnpm install
pnpm start                 # English, http://localhost:4200
pnpm start:it              # Italian
pnpm build && pnpm check   # both locales built; check asserts the output
```

## The key contract: `@@id`

Every template string carries `i18n="@@<key>"`, and `<key>` is the Translify key:

```html
<h1 i18n="@@cartTitle">Your cart</h1>
```

Angular's XLIFF unit ids are therefore the catalog's keys, and the file `translify pull` writes lines up with no extraction step. The source locale (`en-US`) needs no XLIFF: the template text is the source. `messages.en-US.xlf` is still pulled and committed so `translify status` sees every locale of the rule.

`translify.json`:

```json
{ "files": [{ "pattern": "src/locale/messages.{locale}.xlf", "format": "xliff", "namespace": "cart" }] }
```

`angular.json` declares `i18n.sourceLocale: "en-US"` and `i18n.locales["it-IT"].translation`, `localize: true` on the build, and an `it` configuration for `ng serve`. The build warns *"Locale data for 'it-IT' cannot be found. Using locale data for 'it'"*: Angular ships CLDR data per language, and `it` is the right fallback.

## Placeholders — current limitation

Angular writes `{{ }}` interpolations as `<ph>` units and template ICU as `{VAR_PLURAL, …}`; Translify stores plain ICU text (`Hello, {name}`). They do not match yet, so this example uses only the catalog's plain keys; `itemCount` and `greeting` are shown in the React and Flutter examples. Tracked as TRLIFY-98.

## Adding a key

1. Add `<span i18n="@@newKey">New text</span>` to a template.
2. `pnpm exec ng extract-i18n --format=xlf2 --output-path src/locale --out-file messages.en-US.xlf`
3. `npx translify push` — the server accepts a source-only XLIFF for the default locale.
4. Translate `newKey` in Translify, then `npx translify pull`.

## In CI

```yaml
- run: npx translify pull
  env:
    TRANSLIFY_SECRET_KEY: ${{ secrets.TRANSLIFY_SECRET_KEY }}
- run: pnpm install --frozen-lockfile && pnpm build && pnpm check
```

`pnpm-workspace.yaml` allows the postinstall scripts of `esbuild`, `lmdb` and `@parcel/watcher` (pnpm 10+ blocks build scripts by default); without it `ng build` has no esbuild binary.
