import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setForceRevalidate } from '../translify/backend';

export const LocaleSwitcher = ({
  locales,
  showRevalidate,
}: {
  locales: string[];
  /** The cache-busting button belongs to diagnostics mode, not the example. */
  showRevalidate: boolean;
}): React.ReactNode => {
  const { t, i18n } = useTranslation();
  const labelFor = (locale: string): string => (locale.startsWith('it') ? t('localeIt') : t('localeEn'));
  const [busy, setBusy] = useState(false);

  const switchTo = (locale: string): void => {
    setBusy(true);
    void i18n.changeLanguage(locale).finally(() => setBusy(false));
  };

  /**
   * `Cache-Control: public, max-age=60` means a repeat request inside a minute is
   * served from the browser's HTTP cache with no network row in the log. This
   * forces a real round trip so the cache is observable rather than invisible.
   */
  const revalidate = (): void => {
    setBusy(true);
    setForceRevalidate(true);
    void i18n
      .reloadResources([i18n.language])
      .finally(() => {
        setForceRevalidate(false);
        setBusy(false);
      });
  };

  return (
    <div className="flex items-center gap-2">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={busy}
          onClick={() => switchTo(locale)}
          className={`rounded border px-3 py-1 text-sm ${
            i18n.language === locale ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
          }`}
        >
          {labelFor(locale)}
        </button>
      ))}
      {showRevalidate && (
        <button
          type="button"
          disabled={busy}
          onClick={revalidate}
          className="rounded border border-neutral-300 px-3 py-1 text-sm"
        >
          Force revalidate
        </button>
      )}
    </div>
  );
};
