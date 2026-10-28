# Build-time example — Android resources over strings.xml

Android strings are compiled in from `res/values*/strings.xml`. `translify pull` writes one file per locale and `aapt2` compiles them; no conversion step in between.

```
Translify (ICU) ──translify pull──▶ app/src/main/res/values-it/strings.xml ──aapt2 compile/link──▶ app.apk
```

`translify.json`:

```json
{ "files": [{ "pattern": "app/src/main/res/values-{locale}/strings.xml", "format": "android", "namespace": "android" }],
  "locales": { "en": "en-US", "it": "it-IT" } }
```

With `format: android` the project's default locale goes to `values/` (no qualifier) and every other locale to `values-<locale>/`. The namespace is required.

## What the format does

Translify stores ICU; the `android` format renders positional Java printf on the way out and parses it back on push.

| Translify | What `pull` writes |
|---|---|
| `Hello, {name}` | `Hello, %1$s` |
| `{name} bought {count, number} items` | `%1$s bought %2$d items` |
| `{count, plural, one {# item} other {# items}}` | `<plurals>` with `quantity` items using `%1$d` |
| `colors.0`, `colors.1`, `colors.2` | `<string-array name="colors">` |
| `20% today` | `20%% today` |
| `<b>Translify</b>` | kept verbatim as markup |

An apostrophe is always written `\'` (aapt2 refuses a bare one) and `&`, `<`, `>` in text are entity-escaped.

## The `donottranslate.xml` rule

`values/donottranslate.xml` holds a `translatable="false"` string. Push skips such elements, so they stay in the app and never reach Translify or the translators.

## Run it

```sh
npx translify pull        # writes values/strings.xml and values-it/strings.xml
./verify.sh               # aapt2 compile + link, then compares the resource table with expected/dump.txt
```

`verify.sh` finds `aapt2` and `android.jar` under `$ANDROID_HOME` (the highest version installed; on a Mac it falls back to `~/Library/Android/sdk`). If aapt2 rejects any pulled file, the script fails; otherwise it prints `ok`. The CI job `android-xml` runs it on `ubuntu-latest`, whose image ships the SDK.

The weekly `drift` job runs `translify status` on this folder like on the others, so the committed files are proven identical to a fresh pull.

## Adding a key

1. Add the string to `values/strings.xml` and `translify push` (a source file overwrites and creates keys).
2. Translate it in the web app, then `npx translify pull`.
3. Run `./verify.sh` and update `expected/dump.txt` with the new resource table.
