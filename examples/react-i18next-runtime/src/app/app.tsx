import { useTranslation } from 'react-i18next';
import type { TranslifyClient } from '@translifyhq/client';
import type { TranslifyConfig } from '../config';
import { useLoadOutcome } from '../diagnostics/client-events';
import { DiagnosticsDrawer } from '../diagnostics/drawer';
import { DeliveryErrorCard } from './delivery-error-card';
import { CartPage } from './cart-page';
import { LocaleSwitcher } from './locale-switcher';
import { diagnosticsEnabled } from './diagnostics-flag';

export const App = ({ config, client }: { config: TranslifyConfig; client: TranslifyClient }): React.ReactNode => {
  const { i18n } = useTranslation();
  const diagnostics = diagnosticsEnabled(window.location.search, import.meta.env as Record<string, string | undefined>);
  // What the client last said about the current language: a bundle, or a load that failed.
  // Read from the per-locale outcome, not the event log: clearing the drawer must not change the page.
  const outcome = useLoadOutcome(i18n.language);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {config.projectSlug} / {config.envSlug}
        </h1>
        <LocaleSwitcher locales={config.locales} showRevalidate={diagnostics} client={client} />
      </header>
      {outcome?.kind === 'error' ? <DeliveryErrorCard event={outcome} /> : <CartPage />}
      {diagnostics && <DiagnosticsDrawer config={config} />}
    </main>
  );
};
