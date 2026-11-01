# Build-time example — Rails locale files over YAML

A Rails app reads `config/locales/<locale>.yml` through Ruby's `I18n`. `translify pull` writes those files and the app loads them as they are; no conversion step in between.

```
Translify (ICU) ──translify pull──▶ config/locales/it.yml ──I18n.load_path──▶ app.rb
```

`translify.json`:

```json
{ "files": [{ "pattern": "config/locales/{locale}.yml", "format": "yaml", "yamlDialect": "rails", "namespace": "rails" }],
  "locales": { "en": "en-US", "it": "it-IT" } }
```

`yamlDialect: rails` makes every file a Rails document: one root key (the locale) over the whole tree. Each `format: yaml` rule takes one fixed namespace, here `rails`.

## The `locales` alias

The project's locales are `en-US` and `it-IT`, but a Rails app wants the root keys `en:` and `it:`. The `locales` map in `translify.json` aliases the short code the file is named after (and the root key) to the Translify locale, so `config/locales/it.yml` starts with `it:` and holds the `it-IT` translations.

## What the format does

Translify stores ICU; the `rails` dialect renders Rails interpolation on the way out and parses it back on push.

| Translify | What `pull` writes |
|---|---|
| `Hello {name}` | `Hello %{name}` |
| `{count, plural, zero {No items} one {# item} other {# items}}` | a hash `items:` with `one`, `other`, `zero` (`#` becomes `%{count}`) |
| `day_names.0` … `day_names.6` | a YAML sequence `day_names:` |
| an empty list slot (`abbr_month_names.0`) | `-` (nil), which `I18n.l` expects for the first month |
| `:year`, `:month`, `:day` | raw symbols `- :year` |
| `:"app.cart.title"` | the link kept as a raw symbol, `heading: :app.cart.title`, which Rails resolves at lookup time |
| `<b>Welcome</b> back` | kept verbatim, written quoted because it starts with `<` |
| `3`, `false` | YAML scalars (`precision: 3`, `strip_insignificant_zeros: false`) |

The files here are in the layout `i18n-tasks normalize` writes: keys sorted at every level (so plural categories come out `one`, `other`, `zero`), a sequence not indented under its key, nothing wrapped. Comments do not survive that layout, so none are written.

## The `line_width: -1` note

`config/i18n-tasks.yml` sets `data.yaml.write.line_width: -1`. Without it `i18n-tasks` (Psych) wraps a long plain scalar at 80 columns, while Translify never wraps; with it, `translify pull` and `i18n-tasks normalize` give byte-identical files. A Rails project that normalizes its locale files needs this one line.

## Partially translated lists are refused

A list is written only when every item is translated. A target locale with some of `day_names.0` … `day_names.6` empty makes `pull` refuse with `arrayGap` rather than write a shorter list that would shift the days. `it.yml` therefore has every item filled.

## Run it

```sh
npx translify pull        # writes config/locales/en.yml and it.yml
bundle install
./verify.sh               # renders every key for it, then runs i18n-tasks normalize
```

`verify.sh` runs `app.rb it` (which loads the pulled files with `I18n`) and compares its output with `expected/it.json`: the link resolves, `abbr_month_names` starts with `null`, `order` keeps its symbols, count 0 picks `zero`, dates and numbers follow the Italian formats. It then runs `i18n-tasks normalize` and fails on any change to `config/locales` through `git diff`, so the folder must be a git checkout with the files staged or committed. If any pulled file is not already canonical, the script fails; otherwise it prints `ok`. Needs Ruby 3.3 and Bundler (`i18n` and `i18n-tasks 1.0.14` are pinned in the `Gemfile`).

The weekly `drift` job runs `translify status` on this folder like on the others, so the committed files are proven identical to a fresh pull.

## Adding a key

1. Add the key to `config/locales/en.yml` (keep it sorted) and `translify push` (a source file overwrites and creates keys).
2. Translate it in the web app, then `npx translify pull`.
3. Run `./verify.sh` and update `expected/it.json` with `bundle exec ruby app.rb it > expected/it.json` if you added a key `app.rb` prints.
