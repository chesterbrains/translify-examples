import { useSyncExternalStore } from 'react';
import type { DeliveryExchange } from '../translify/types';

export const MAX_EXCHANGES = 200;

/** Append with a cap, oldest first out. Pure, so it is the tested part of this module. */
export const pushCapped = <T,>(list: readonly T[], item: T, max: number): T[] => {
  const next = [...list, item];

  return next.length > max ? next.slice(next.length - max) : next;
};

let exchanges: DeliveryExchange[] = [];
let missingKeys: string[] = [];
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

export const appendExchange = (exchange: DeliveryExchange): void => {
  exchanges = pushCapped(exchanges, exchange, MAX_EXCHANGES);
  notify();
};

export const appendMissingKey = (key: string): void => {
  if (missingKeys.includes(key)) return;
  missingKeys = [...missingKeys, key];
  notify();
};

export const clearExchanges = (): void => {
  exchanges = [];
  notify();
};

export const useExchanges = (): DeliveryExchange[] =>
  useSyncExternalStore(subscribe, () => exchanges);

export const useMissingKeys = (): string[] =>
  useSyncExternalStore(subscribe, () => missingKeys);
