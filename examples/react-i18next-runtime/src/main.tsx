import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readConfig } from './translify/config';
import { initI18n } from './i18n';
import { SetupScreen } from './app/setup-screen';
import { App } from './app/app';
import './index.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root missing from index.html');

const result = readConfig(import.meta.env as Record<string, string | undefined>);

if (!result.ok) {
  createRoot(root).render(
    <StrictMode>
      <SetupScreen missing={result.missing} />
    </StrictMode>,
  );
} else {
  // i18next resolves even when the backend read fails; App reads the exchange
  // log to decide whether to render the error card.
  void initI18n(result.config).then(() => {
    createRoot(root).render(
      <StrictMode>
        <App config={result.config} />
      </StrictMode>,
    );
  }).catch((error: unknown) => {
    createRoot(root).render(
      <StrictMode>
        <main className="mx-auto max-w-xl p-8">
          <h1 className="text-xl font-semibold text-red-900">Failed to start</h1>
          <p className="mt-2 text-sm text-red-800">{error instanceof Error ? error.message : String(error)}</p>
        </main>
      </StrictMode>,
    );
  });
}
