import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A client-rendered Angular app keeps its strings in the JS bundles, not in index.html.
// Every string of a locale must be present: the plain title, the interpolation's text and the
// plural's `other` branch prove the Angular XLIFF dialect compiled in (TRLIFY-98).
const expectations = {
  'en-US': ['Your cart', 'Hello, ', ' items'],
  'it-IT': ['Il tuo carrello', 'Ciao, ', ' articoli'],
};

const browserDir = join('dist', 'angular-xliff', 'browser');

const filesUnder = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

let failed = false;
for (const [locale, texts] of Object.entries(expectations)) {
  const dir = join(browserDir, locale);
  let bundles = [];
  try {
    bundles = filesUnder(dir)
      .filter((path) => path.endsWith('.js'))
      .map((path) => readFileSync(path, 'utf8'));
  } catch {
    // missing dir → nothing found
  }
  for (const text of texts) {
    const found = bundles.some((bundle) => bundle.includes(text));
    console.log(`${found ? 'ok  ' : 'FAIL'} ${locale}: ${JSON.stringify(text)} ${found ? 'present' : 'missing'} in ${dir}`);
    failed ||= !found;
  }
}
process.exit(failed ? 1 : 0);
