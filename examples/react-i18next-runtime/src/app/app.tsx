import { useTranslation } from 'react-i18next';
import type { TranslifyConfig } from '../translify/types';
import { useExchanges } from '../diagnostics/exchange-log';
import { DiagnosticsDrawer } from '../diagnostics/drawer';
import { DeliveryErrorCard } from './delivery-error-card';
import { CartPage } from './cart-page';
import { LocaleSwitcher } from './locale-switcher';

export const App = ({ config }: { config: TranslifyConfig }): React.ReactNode => {
  const { i18n } = useTranslation();
  const exchanges = useExchanges();
  const lastAppExchange = [...exchanges].reverse().find((entry) => entry.label.startsWith(`app: ${i18n.language}/`));
  const failed =
    lastAppExchange !== undefined &&
    (lastAppExchange.outcome.kind === 'network' || lastAppExchange.outcome.status !== 200);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {config.projectSlug} / {config.envSlug}
        </h1>
        <LocaleSwitcher locales={config.locales} />
      </header>
      {failed && lastAppExchange !== undefined ? (
        <DeliveryErrorCard exchange={lastAppExchange} />
      ) : (
        <CartPage />
      )}
      <DiagnosticsDrawer config={config} />
    </main>
  );
};
