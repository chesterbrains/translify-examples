import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // intl-messageformat ships CJS-first with no `exports` map: Node's ESM loader hands
    // i18next-icu the module object instead of the class ("IntlMessageFormat is not a
    // constructor"). Inlining both runs them through Vite's resolver, which picks the
    // ESM `module` build exactly as the browser bundle does.
    server: { deps: { inline: ['i18next-icu', 'intl-messageformat'] } },
  },
});
