import type { TranslifyClient } from '@translifyhq/client';
import { toErrorEvent, type ClientEvent } from '../diagnostics/client-events';

/**
 * "Force revalidate": ask the client to revalidate now instead of waiting for the next load.
 * `refresh` resolves with the locale's bundle; the client keeps the same object when nothing
 * changed (a 304, or a 200 with identical content), so identity is the whole comparison.
 *
 * Errors are reported once. For a locale the client holds, `refresh` both calls `onError`
 * (already recorded by the app) and rejects, so a rejection here emits nothing. For a locale it
 * does not hold, `refresh` falls through to `load`, which only rejects, so that failure is
 * recorded here as a load error. Resolves `true` when the refresh succeeded.
 */
export const revalidate = async (
  client: TranslifyClient,
  locale: string,
  emit: (event: ClientEvent) => void,
  now: () => number = () => performance.now(),
  clock: () => number = Date.now,
): Promise<boolean> => {
  const before = client.bundle(locale);
  const held = before !== undefined;
  const started = now();
  try {
    const after = await client.refresh(locale);
    emit({ kind: 'revalidated', locale, changed: after !== before, ms: now() - started, at: clock() });

    return true;
  } catch (error) {
    if (!held) emit(toErrorEvent(error, 'load', locale, clock()));

    return false;
  }
};
