import { useTranslation } from 'react-i18next';
import type { TranslifyConfig } from '../translify/types';
import { useExchanges } from '../diagnostics/exchange-log';
import { DeliveryErrorCard } from './delivery-error-card';

export const App = ({ config }: { config: TranslifyConfig }): React.ReactNode => {
  const { i18n } = useTranslation();
  const exchanges = useExchanges();
  const lastAppExchange = [...exchanges].reverse().find((entry) => entry.label.startsWith('app: '));
  const failed =
    lastAppExchange !== undefined &&
    (lastAppExchange.outcome.kind === 'network' || lastAppExchange.outcome.status !== 200);

  const bundle = i18n.getResourceBundle(i18n.language, 'translation') as
    | Record<string, string>
    | undefined;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-xl font-semibold">
        {config.projectSlug} / {config.envSlug}
      </h1>
      {failed && lastAppExchange !== undefined ? (
        <DeliveryErrorCard exchange={lastAppExchange} />
      ) : (
        <p className="text-sm text-neutral-600">
          Loaded {Object.keys(bundle ?? {}).length} keys for {i18n.language}.
        </p>
      )}
    </main>
  );
};
