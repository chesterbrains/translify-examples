# Build-time example — Flutter + ARB

`translify pull` writes `lib/l10n/app_en.arb` and `app_it.arb`; `flutter gen-l10n` compiles them into `AppLocalizations`. Strings are part of the build: no network at runtime, no key in the app.

```
CI ──npx translify pull──▶ lib/l10n/app_*.arb ──flutter gen-l10n──▶ AppLocalizations ──▶ app
```

## Run it

The pulled ARB files are committed, so this works with no key:

```sh
flutter pub get      # also runs gen-l10n (pubspec: generate: true)
flutter run
flutter test
```

## Refresh the translations

Seed the project first ([root README](../../README.md)). Then, with `TRANSLIFY_SECRET_KEY` (`PULL` scope) exported:

```sh
npx translify pull && flutter gen-l10n
```

`translify.json`:

```json
{
  "files": [{ "pattern": "lib/l10n/app_{locale}.arb", "format": "arb", "namespace": "cart" }],
  "locales": { "en": "en-US", "it": "it-IT" }
}
```

- ARB rules always name one fixed `namespace`; `gen-l10n` builds one class from one template file.
- The Translify project uses `en-US` / `it-IT`; on disk the files are `app_en.arb` / `app_it.arb` because `gen-l10n` refuses a country-coded locale without a base one. The `locales` map does the renaming, and `pull` writes `@@locale` as the on-disk name (`en`), which `gen-l10n` requires.
- ICU plurals and arguments come through as typed methods: `l10n.itemCount(3)`, `l10n.greeting('Alex')`. Inside a plural branch write `{count}`, not ICU's `#`: `gen-l10n` renders `#` literally, while `{count}` works in Flutter and in every other ICU consumer.

## In CI

```yaml
- uses: subosito/flutter-action@v2
  with: { channel: stable }
- run: npx translify pull && flutter gen-l10n && flutter test
  env:
    TRANSLIFY_SECRET_KEY: ${{ secrets.TRANSLIFY_SECRET_KEY }}
```

To fail a pull request when the committed ARB files drift from Translify, run `npx translify status` instead of `pull`.
