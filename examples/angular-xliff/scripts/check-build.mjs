import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A client-rendered Angular app keeps its strings in the JS bundles, not in index.html.
const expectations = {
  'en-US': 'Your cart',
  'it-IT': 'Il tuo carrello',
};

const browserDir = join('dist', 'angular-xliff', 'browser');

const filesUnder = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

let failed = false;
for (const [locale, text] of Object.entries(expectations)) {
  const dir = join(browserDir, locale);
  let found = false;
  try {
    found = filesUnder(dir)
      .filter((path) => path.endsWith('.js'))
      .some((path) => readFileSync(path, 'utf8').includes(text));
  } catch {
    // missing dir → found stays false
  }
  console.log(`${found ? 'ok  ' : 'FAIL'} ${locale}: ${JSON.stringify(text)} ${found ? 'present' : 'missing'} in ${dir}`);
  failed ||= !found;
}
process.exit(failed ? 1 : 0);
