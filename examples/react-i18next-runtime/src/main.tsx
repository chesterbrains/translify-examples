import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTranslify, localStorageStorage, type TranslifyClient } from '@translifyhq/client';
import { readConfig } from './config';
import { initI18n, NAMESPACES } from './i18n';
import { appendClientEvent, toErrorEvent } from './diagnostics/client-events';
import { SetupScreen } from './app/setup-screen';
import { App } from './app/app';
import './index.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root missing from index.html');

const FailedToStart = ({ error }: { error: unknown }): React.ReactNode => (
  <main className="mx-auto max-w-xl p-8">
    <h1 className="text-xl font-semibold text-red-900">Failed to start</h1>
    <p className="mt-2 text-sm text-red-800">{error instanceof Error ? error.message : String(error)}</p>
  </main>
);

const result = readConfig(import.meta.env as Record<string, string | undefined>);

if (!result.ok) {
  createRoot(root).render(
    <StrictMode>
      <SetupScreen missing={result.missing} />
    </StrictMode>,
  );
} else {
  const { config } = result;
  let client: TranslifyClient;
  try {
    // The whole runtime setup. `baseUrl` has no default on purpose: the API hostname is yours
    // to pin. `localStorageStorage()` makes the second page load render from the cached bundle
    // at once while the client revalidates in the background; `onError` is the only place a
    // background failure surfaces, and the diagnostics drawer records it.
    client = createTranslify({
      baseUrl: config.baseUrl,
      project: config.projectSlug,
      environment: config.envSlug,
      key: config.apiKey,
      namespaces: [...NAMESPACES],
      storage: localStorageStorage(),
      onError: (error) => appendClientEvent(toErrorEvent(error, 'revalidate')),
    });
  } catch (error) {
    // `createTranslify` validates synchronously: a secret key or a relative base URL ends here.
    createRoot(root).render(
      <StrictMode>
        <FailedToStart error={error} />
      </StrictMode>,
    );
    throw error;
  }

  // i18next resolves even when the backend read fails; App reads the client events to decide
  // whether to render the error card.
  void initI18n(client, config)
    .then(() => {
      createRoot(root).render(
        <StrictMode>
          <App config={config} client={client} />
        </StrictMode>,
      );
    })
    .catch((error: unknown) => {
      createRoot(root).render(
        <StrictMode>
          <FailedToStart error={error} />
        </StrictMode>,
      );
    });
}
