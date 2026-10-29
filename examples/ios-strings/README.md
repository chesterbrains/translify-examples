# Build-time example — Swift package + `.strings` / `.stringsdict` tables

For projects that still ship `Localizable.strings` and `Localizable.stringsdict` in `.lproj` folders instead of a String Catalog (new projects: see [`ios-xcstrings`](../ios-xcstrings)). `translify pull` writes both tables per locale; Foundation reads them as they are, with no import step.

```
Translify (ICU) ──translify pull──▶ Sources/App/it.lproj/Localizable.strings      (plain text)
                                  ▶ Sources/App/it.lproj/Localizable.stringsdict  (plurals)
```

`translify.json`:

```json
{ "files": [
    { "pattern": "Sources/App/{locale}.lproj/Localizable.strings", "format": "strings", "namespace": "ios" },
    { "pattern": "Sources/App/{locale}.lproj/Localizable.stringsdict", "format": "stringsdict", "namespace": "ios" }
  ],
  "locales": { "en": "en-US", "it": "it-IT" } }
```

The two rules share the `ios` namespace: each key goes to one file, chosen by its English source. Plain text goes to `.strings`; a plural, alone or inside text, goes to `.stringsdict`. The `locales` map keeps the folder names `en.lproj` / `it.lproj`.

## What the formats do

Translify stores ICU; the CLI converts on the way out and back, so the same catalog serves React, Flutter, Angular, Android and both iOS examples.

| Translify (`catalog/`) | File | What `pull` writes |
|---|---|---|
| `Your cart` | `.strings` | `"plain" = "Your cart";` |
| `Hello, {name}` | `.strings` | `"greeting" = "Hello, %1$@";` |
| `{name} bought {count, number} items` | `.strings` | `"positional" = "%1$@ bought %2$lld items";` |
| `{count, plural, one {# item} other {# items}}` | `.stringsdict` | format key `%1$#@count@`, variants `%1$lld item` / `%1$lld items` |
| `You have {count, plural, one {# item} other {# items}} in your cart` | `.stringsdict` | format key `You have %1$#@count@ in your cart`, same variants |

Arguments are positional, numbered by first appearance in the English source, so an Italian translation that reorders them keeps its meaning. A key's description is written as a `/* comment */` above it in the English `.strings` file. Not supported: `select`, `offset`, two plurals in one message (the pull refuses them with `STRINGS_UNSUPPORTED`).

## Run it

```sh
npx translify pull       # writes en.lproj and it.lproj
swift run App it         # prints every key formatted from it.lproj, as JSON
```

`./verify.sh` lints the four tables with `plutil`, builds, runs the executable against `it.lproj` and diffs its output with `expected/it.json`. It needs Swift and `plutil`, so it runs by hand on a Mac (no macOS job in CI: those minutes cost 10× Linux on a shared pool). Verified on 2026-10-29 with Swift 6.4 on macOS 27:

```
Sources/App/en.lproj/Localizable.strings: OK
Sources/App/it.lproj/Localizable.strings: OK
Sources/App/en.lproj/Localizable.stringsdict: OK
Sources/App/it.lproj/Localizable.stringsdict: OK
Build complete! (0,30 s)
ok: it.lproj output matches expected/it.json
```

The executable reads each `.lproj` through its own `Bundle`, so the output does not depend on the Mac's language. The weekly `drift` job runs `translify status` on this folder like on the others, so the committed tables are proven byte-identical to a fresh pull on Linux.

## Adding a key

1. Add it to `catalog/locales/*/ios.json` first and `translify push` from `catalog/`: the catalog is the source of truth and gives the argument its ICU name (`{name}`). A key created from a `.strings` push instead gets positional names (`{arg1}`), which the other platforms would then have to use too.
2. `npx translify pull` here writes it into the right table; use it from code with `String(localized:)` or `NSLocalizedString` plus `String(format:)`.
3. Run `./verify.sh`, then add the key to `main.swift` and `expected/it.json`.
