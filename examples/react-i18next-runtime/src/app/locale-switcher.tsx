import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslifyClient } from '@translifyhq/client';
import { appendClientEvent } from '../diagnostics/client-events';
import { revalidate } from './revalidate';

export const LocaleSwitcher = ({
  locales,
  showRevalidate,
  client,
}: {
  locales: string[];
  /** The revalidate button belongs to diagnostics mode, not the example. */
  showRevalidate: boolean;
  client: TranslifyClient;
}): React.ReactNode => {
  const { t, i18n } = useTranslation();
  const labelFor = (locale: string): string => (locale.startsWith('it') ? t('localeIt') : t('localeEn'));
  const [busy, setBusy] = useState(false);

  const switchTo = (locale: string): void => {
    setBusy(true);
    void i18n.changeLanguage(locale).finally(() => setBusy(false));
  };

  /**
   * The client revalidates on its own after every `load`; this asks it to do so right now.
   * A changed bundle reaches the screen through the backend's `subscribe` listener;
   * `reloadResources` additionally makes i18next re-read, which finds the fresh bundle in
   * the client's memory.
   */
  const forceRevalidate = (): void => {
    setBusy(true);
    void revalidate(client, i18n.language, appendClientEvent)
      .then((ok) => (ok ? i18n.reloadResources([i18n.language]) : undefined))
      .finally(() => setBusy(false));
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
        <button type="button" disabled={busy} onClick={forceRevalidate} className="rounded border border-neutral-300 px-3 py-1 text-sm">
          Force revalidate
        </button>
      )}
    </div>
  );
};
