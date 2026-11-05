# Build-time example — Symfony translations over YAML

A Symfony app reads `translations/<domain>.<locale>.yaml` through the Translation component. `translify pull` writes those files and the standalone `Translator` loads them as they are; no conversion step in between.

```
Translify (ICU) ──translify pull──▶ translations/*.yaml ──YamlFileLoader──▶ app.php
```

`translify.json`:

```json
{ "files": [
    { "pattern": "translations/checkout+intl-icu.{locale}.yaml", "format": "yaml", "yamlDialect": "symfony-icu", "namespace": "checkout", "jsonStyle": "nested" },
    { "pattern": "translations/messages.{locale}.yaml", "format": "yaml", "yamlDialect": "symfony", "namespace": "messages", "jsonStyle": "flat" }
  ],
  "locales": { "en": "en-US", "it": "it-IT" } }
```

Two domains, one per dialect. `messages` is the legacy style (`%name%` placeholders, pipe plurals), `checkout` is written in ICU from day one, so its file carries Symfony's `+intl-icu` suffix and the Translator formats it with `MessageFormatter` from `ext-intl`. A domain is legacy **or** ICU, never both: `messages.en.yaml` next to `messages+intl-icu.en.yaml` is the one pair the CLI refuses (and `translify init` warns about), because both are the domain `messages` to Symfony and one Translify namespace owns one dialect.

This folder pins each rule to its `namespace` because the demo project is shared with the other examples; a real Symfony project uses the wildcard form, `translations/{namespace}.{locale}.yaml` and `translations/{namespace}+intl-icu.{locale}.yaml`, so every domain is pulled.

## The `locales` alias

The project's locales are `en-US` and `it-IT`, but a Symfony app names its files `messages.it.yaml` and sets the locale `it`. The `locales` map aliases the short code the file is named after to the Translify locale, so `translations/messages.it.yaml` holds the `it-IT` translations and `app.php` runs with `it`.

## What the format does

Translify stores ICU; the `symfony` dialect renders legacy syntax on the way out and parses it back on push, the `symfony-icu` dialect writes the stored text as it is.

| Translify | What `pull` writes |
|---|---|
| `Hello {name}` | `messages`: `'Hello %name%'` · `checkout`: `'Hello {name}'`, and `trans()` renders both as `Ciao Ada` from the same `['%name%' => 'Ada']` call (`IntlFormatter` strips the `%`) |
| `{count, plural, =0 {No items} =1 {One item} other {# items}}` | `messages`: `'{0} No items\|{1} One item\|%count% items\|%count% items'` — the exact branches first, then one positional segment per Symfony slot (`en` and `it` have `one` and `other`), so the `one` slot repeats `other`'s text, as the idiomatic `{1}` form implies · `checkout`: the ICU message verbatim |
| `007`, `yes`, `no` | `'007'`, `'yes'`, `'no'`: the dumper quotes anything that looks numeric or like a YAML special word, exactly as `Yaml::dump` does. symfony/yaml itself reads a bare `yes`, `no` or `007` as a string, so the quotes protect the files from YAML 1.1 tools and from a later edit, and `verify.php` checks that `Yaml::parse` still gives strings. On push a bare `007` is a string too, while a bare `7`, `true` or `2026-01-01` is the row error `nonStringLeaf`: quote it |
| `Login \| Register` | `'Login \| Register'`: a lone pipe in prose stays text; push reads a pipe as a plural only next to an interval or `%count%` |
| `app.title`, not translated in `it` | absent from `messages.it.yaml`; Symfony falls back to `en` and the app shows `Acme Ecom` |
| `steps.hints.0` … `steps.hints.2` | in the `nested` layout a level whose keys are `0 … n-1` is written as a YAML sequence under `hints:`; Symfony's loader flattens it back to `steps.hints.0` |

The `checkout` file is written as a tree (`jsonStyle: nested`, what `translation:extract --as-tree` writes), `messages` flat (one dotted id per line, the extractor's default). `app.php` looks every key up by its dotted id in both, which is the proof that Symfony reads either layout.

## The first pull normalises once

Translify rebuilds every pulled file from the database; it never keeps the uploaded bytes. The files here were hand-written with `]1,Inf[ %count% items` and came back from the first `pull` in the form above: keys sorted at every level, 4-space indent, symfony/yaml's quoting, the plural in slot form. After that a pull rewrites nothing that did not change, and a pulled file pushed back unchanged is `0 updated`.

## What `verify.php` proves

`php verify.php` runs `app.php it`, which loads the pulled files with the standalone `Translator` (a `YamlFileLoader` per domain, `checkout+intl-icu` registered under that name exactly as the framework does), and compares its output with `expected/it.json`: both greetings render `Ciao Ada`, the legacy and the ICU plural give the same three strings for 0, 1 and 5, `007` renders as `007`, the untranslated key falls back to English, the nested keys resolve. It then parses the `messages` files with symfony/yaml and checks that `settings.agent`, `settings.confirm` and `settings.decline` are still strings (`'007'`, not `7`).

Then it re-parses each `translations/*.yaml` and dumps it again with `Yaml::dump($data, PHP_INT_MAX, 4)`: the bytes must be identical to the file. Translify's emitter is a port of Symfony's own dumper, so what `pull` writes is what `Yaml::dump` would write for the same content, byte for byte.

The script refuses to run without `ext-intl`: without it the `+intl-icu` domain would silently render through the legacy formatter and the comparison would prove nothing.

## Run it

```sh
composer install
export TRANSLIFY_SECRET_KEY=sk_...   # PULL scope
npx translify pull        # writes translations/*.yaml
php verify.php            # renders every key for it, then the Yaml::dump byte check
```

Needs PHP 8.3 with `intl` (Homebrew's `php` ships it) and Composer; without `vendor/` the script stops with a `composer install` hint. Prints `ok` on success; on a mismatch it prints a unified diff (a plain line-by-line diff when `diff` is not on the PATH, as on Windows without Git Bash) and exits 1.

CI runs `translify status` on this folder like on the others, so the committed files are proven identical to a fresh pull.

## Adding a key

1. Add the key to `translations/messages.en.yaml` or `translations/checkout+intl-icu.en.yaml` (keep it sorted; quote anything that looks like a number, a boolean or a date) and `npx translify push` (a source file overwrites and creates keys).
2. Translate it in the web app, then `npx translify pull`.
3. Add it to `app.php` if it should be checked, then refresh the expectation with `php app.php it > expected/it.json` and read the file: the values in it are the proof, so check them before committing.
