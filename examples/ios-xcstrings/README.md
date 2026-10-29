# Build-time example — Swift package + String Catalog over Xcode XLIFF

iOS strings are compiled in from a String Catalog (`Sources/App/Localizable.xcstrings`). `translify pull` writes the XLIFF 1.2 Xcode imports; `xcodebuild -importLocalizations` puts the translations into the catalog.

A project that still uses `Localizable.strings` / `.stringsdict` instead of a String Catalog can pull those tables directly: see [`ios-strings`](../ios-strings).

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

1. Add it to `catalog/locales/*/ios.json` first and `translify push` from `catalog/`: the catalog is the source of truth and gives the argument its ICU name (`{name}`). A key created from an Xcode export instead gets positional names (`{arg1}`), which the other platforms would then have to use too.
2. Add the entry to the String Catalog in Xcode with the same key; `npx translify pull` writes the units.
3. To push translator edits made in Xcode back: `xcodebuild -exportLocalizations -localizationPath out -exportLanguage it`, copy the `.xliff` to `Localization/it.xliff`, `npx translify push` — the server maps Xcode's positional placeholders onto the key's existing argument names and keeps the printf types for the next pull.
