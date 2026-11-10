# Translify examples

Complete, copyable apps showing how to use [Translify](https://translify.tommasofeltrin.work) from a repository: one catalog pushed with the CLI, published once, consumed three ways.

| Example | Style | Format | Toolchain | Shows |
|---|---|---|---|---|
| [`examples/react-i18next-runtime`](examples/react-i18next-runtime) | **runtime** | JSON (delivery endpoint) | Vite · React · i18next · `@translifyhq/client` | `@translifyhq/client` behind a custom i18next backend, `localStorage` cache, live updates on publish, ICU plural, diagnostics drawer |
| [`examples/flutter-arb`](examples/flutter-arb) | build-time | ARB | Flutter `gen-l10n` | `translify pull`, `locales` map, `@@locale`, ICU plural |
| [`examples/ios-xcstrings`](examples/ios-xcstrings) | build-time | XLIFF 1.2 | Xcode String Catalog | `translify pull` with `xliffDialect: xcode` (ICU ↔ positional printf, `\|==\|` plural and substitution units), `xcodebuild -importLocalizations`, verified by hand on a Mac |
| [`examples/ios-strings`](examples/ios-strings) | build-time | `.strings` + `.stringsdict` | Foundation `.lproj` tables | `translify pull` with `format: strings` and `format: stringsdict` sharing one namespace (ICU ↔ positional printf, plurals as `NSStringPluralRuleType`), for projects without a String Catalog, verified by hand on a Mac |
| [`examples/android-xml`](examples/android-xml) | build-time | Android strings.xml | Android resources | `translify pull` with `format: android` (ICU ↔ positional printf, `<plurals>`, `<string-array>`), compiled and linked by `aapt2` in CI |
| [`examples/angular-xliff`](examples/angular-xliff) | build-time | XLIFF 2.0 | `@angular/localize` | `translify pull` with `xliffDialect: angular` (ICU ↔ `<ph>` / `VAR_PLURAL`), `@@id` key contract, `ng build --localize`, push from `ng extract-i18n` |
| [`examples/rails-yaml`](examples/rails-yaml) | build-time | Rails YAML | Ruby I18n (`config/locales`) | `translify pull` with `format: yaml` / `yamlDialect: rails` (ICU ↔ `%{name}`, plural hashes, rails-i18n framework data kept), loaded by Ruby I18n and checked against `i18n-tasks normalize` in CI |
| [`examples/symfony-yaml`](examples/symfony-yaml) | build-time | Symfony YAML | `symfony/translation` (`translations/`) | `translify pull` with `yamlDialect: symfony` (legacy `%name%` and pipe plurals) and `symfony-icu` (ICU verbatim) side by side, flat and nested layouts, loaded by the standalone Translator and checked byte-for-byte against `Yaml::dump` in CI |

## Which style?

- **Runtime**: the app fetches the published bundle from `/api/delivery/…` with a delivery key. Publish → live, no release. Web apps; JSON only.
- **Build-time**: `translify pull` in CI writes native files (ARB, XLIFF, JSON) and the platform compiles them in. Needed where strings are compiled (Flutter, Angular), or when you want zero runtime dependency.

Both start from the same catalog.

## Get started

1. In Translify, create an empty project with slug **`acme-ecom`**, locales **`en-US`** (default) and **`it-IT`**, and an environment **`production`**.
2. Create a **secret key** with scopes `PUSH`, `PUBLISH`, `PULL`, then `export TRANSLIFY_SECRET_KEY=sk_…`.
3. Seed and publish:

   ```sh
   cd catalog
   npx translify push
   npx translify publish production
   ```

4. Pick an example from the table. Each folder is self-contained, with its own README.

`catalog/` is the source of truth: namespace `cart` (nine keys, shared by the three cart examples) plus namespace `ios` (five keys shared by the two iOS examples), in flat JSON. Keys are camelCase identifiers so the same catalog pulls as JSON, ARB and XLIFF unchanged (Flutter's `gen-l10n` needs Dart identifiers).

## Reference

- [CLI README](https://github.com/chesterbrains/translify-cli): `translify.json` fields, every command, prune safety, exit and error codes.
- [App docs](https://translify.tommasofeltrin.work/docs): delivery API and CLI quickstart.

## Licence

MIT.
