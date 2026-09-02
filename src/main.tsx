import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readConfig } from './translify/config';
import { SetupScreen } from './app/setup-screen';
import './index.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root missing from index.html');

const result = readConfig(import.meta.env as Record<string, string | undefined>);

createRoot(root).render(
  <StrictMode>
    {result.ok ? (
      <p className="p-8 text-lg">config ok: {result.config.projectSlug}</p>
    ) : (
      <SetupScreen missing={result.missing} />
    )}
  </StrictMode>,
);
