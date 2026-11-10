import { useSyncExternalStore } from 'react';
import { TranslifyError, type TranslifyErrorCode } from '@translifyhq/client';
import { pushCapped } from './exchange-log';

/**
 * What `@translifyhq/client` lets an application observe, and nothing more: the result of
 * `load` and `refresh`, a bundle change from `subscribe`, a background failure from
 * `onError`. No HTTP detail lives here; the Network tab has it.
 */
export type ClientEvent =
  | { kind: 'loaded'; locale: string; keys: number; ms: number; at: number }
  | { kind: 'changed'; locale: string; keys: number; at: number }
  | { kind: 'revalidated'; locale: string; changed: boolean; ms: number; at: number }
  | {
      kind: 'error';
      locale?: string;
      /** `load`: a first load rejected, nothing to paint. `revalidate`: `onError`, background or forced. */
      phase: 'load' | 'revalidate';
      code: TranslifyErrorCode;
      status?: number;
      message: string;
      at: number;
    };

export type ClientErrorEvent = Extract<ClientEvent, { kind: 'error' }>;

export const MAX_CLIENT_EVENTS = 200;

/** A `TranslifyError` keeps its code, status and message; anything else is a server-side surprise. */
export const toErrorEvent = (
  error: unknown,
  phase: ClientErrorEvent['phase'],
  locale?: string,
  at: number = Date.now(),
): ClientErrorEvent => ({
  kind: 'error',
  ...(locale === undefined ? {} : { locale }),
  phase,
  code: error instanceof TranslifyError ? error.code : 'SERVER',
  status: error instanceof TranslifyError ? error.status : undefined,
  message: error instanceof Error ? error.message : String(error),
  at,
});

export type LoadOutcome = Extract<ClientEvent, { kind: 'loaded' }> | ClientErrorEvent;

const isLoadOutcome = (event: ClientEvent): event is LoadOutcome =>
  event.kind === 'loaded' || (event.kind === 'error' && event.phase === 'load');

let events: ClientEvent[] = [];
/**
 * What the page renders from: the last `loaded` or load-phase `error` per locale. Kept apart
 * from the log so the drawer's Clear button and the log's cap never change what the app shows.
 */
let loadOutcomes = new Map<string, LoadOutcome>();
const listeners = new Set<() => void>();

let notifyQueued = false;
const notify = (): void => {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    for (const listener of listeners) listener();
  });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const appendClientEvent = (event: ClientEvent): void => {
  events = pushCapped(events, event, MAX_CLIENT_EVENTS);
  if (isLoadOutcome(event) && event.locale !== undefined) {
    loadOutcomes = new Map(loadOutcomes).set(event.locale, event);
  }
  notify();
};

/** The last load outcome for a locale: a bundle, or the load that failed. Unaffected by Clear. */
export const readLoadOutcome = (locale: string): LoadOutcome | undefined => loadOutcomes.get(locale);

export const clearClientEvents = (): void => {
  events = [];
  notify();
};

export const useClientEvents = (): ClientEvent[] => useSyncExternalStore(subscribe, () => events);

export const useLoadOutcome = (locale: string): LoadOutcome | undefined =>
  useSyncExternalStore(subscribe, () => loadOutcomes.get(locale));
