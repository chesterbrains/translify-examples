# Build-time example — Swift package + String Catalog over Xcode XLIFF

iOS strings are compiled in from a String Catalog (`Sources/App/Localizable.xcstrings`). `translify pull` writes the XLIFF 1.2 Xcode imports; `xcodebuild -importLocalizations` puts the translations into the catalog.

```
Translify (ICU) ──translify pull──▶ Localization/it.xliff ──xcodebuild -importLocalizations──▶ Localizable.xcstrings
```

`translify.json`:

```json
{ "files": [{ "pattern": "Localization/{locale}.xliff", "format": "xliff", "namespace": "ios",
              "xliffDialect": "xcode", "xliffOriginal": "Sources/App/Localizable.xcstrings" }],
  "locales": { "en": "en-US", "it": "it-IT" } }
```

`xliffOriginal` is the catalog path Xcode knows: it goes into `<file original>`, and Xcode imports nothing when it does not match the project. The demo project's locales are `en-US` and `it-IT`; the `locales` map keeps the file names short, and the XLIFF carries `target-language="it-IT"`, which Xcode imports as a regional `it-IT` localization in the catalog.

## What the dialect does

Translify stores ICU; the `xcode` dialect converts on the way out and back, so the same catalog serves React, Flutter, Angular and iOS.

| Translify (`catalog/`) | What `pull` writes | In the String Catalog |
|---|---|---|
| `Hello, {name}` | `greeting` → `Hello, %1$@` | `Hello, %1$@` |
| `{name} bought {count, number} items` | `positional` → `%1$@ bought %2$lld items` | same |
| `{count, plural, one {# item} other {# items}}` | `itemCount\|==\|plural.one` → `%1$lld item`, `…plural.other` → `%1$lld items` | plural variation |
| `You have {count, plural, one {# item} other {# items}} in your cart` | `cartSummary` → `You have %1$#@count@ in your cart` + `cartSummary\|==\|substitutions.count.plural.one` / `.other` | `%#@count@` substitution with `%arg` variants |

Arguments are positional, numbered by first appearance in the English source, so an Italian translation that reorders them keeps its meaning. Not supported in v1: device variations, `select`, `=0`/`offset`, two plurals in one message (the pull refuses them with `XLIFF_DIALECT_UNSUPPORTED`).

## Run it

```sh
npx translify pull                                            # writes Localization/en.xliff and it.xliff
xcodebuild -importLocalizations -localizationPath Localization/it.xliff
swift build
```

`./verify.sh` does the import on a copy, compares the catalog's `it-IT` strings with `expected/it.json`, builds, and restores the catalog. It needs Xcode, so it runs by hand on a Mac (no macOS job in CI: those minutes cost 10× Linux on a shared pool). Verified on 2026-10-11 with Xcode 27.0:

```
Localization Import started for ios-xcstrings
ok: it-IT localizations match expected/it.json
Build complete!
```

The weekly `drift` job runs `translify status` on this folder like on the others, so the committed `.xliff` files are proven byte-identical to a fresh pull on Linux.

## Adding a key

1. Add the entry to the String Catalog in Xcode (or push it from any other example's catalog: the namespace `ios` is its own).
2. `xcodebuild -exportLocalizations -localizationPath out -exportLanguage en`, copy `out/en.xcloc/Localized Contents/en.xliff` to `Localization/en.xliff`, `npx translify push` — the server reads Xcode's export, stores the printf types for the next pull, and names arguments after the key's existing ones.
3. Translate in Translify, `npx translify pull`, import.
