import { describe, expect, it } from 'vitest';
import { TranslifyError } from '@translifyhq/client';
import {
  appendClientEvent,
  clearClientEvents,
  MAX_CLIENT_EVENTS,
  readLoadOutcome,
  toErrorEvent,
  type ClientEvent,
} from './client-events';

const loaded = (locale: string, at: number): ClientEvent => ({ kind: 'loaded', locale, keys: 3, ms: 2, at });
const failed = (locale: string, at: number): ClientEvent => ({
  kind: 'error',
  locale,
  phase: 'load',
  code: 'NOT_FOUND',
  status: 404,
  message: 'x',
  at,
});

describe('toErrorEvent', () => {
  it('copies code, status and message from a TranslifyError', () => {
    const event = toErrorEvent(new TranslifyError('UNAUTHORIZED', 'delivery key refused', 401), 'revalidate', 'it-IT', 5);
    expect(event).toEqual({
      kind: 'error',
      locale: 'it-IT',
      phase: 'revalidate',
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'delivery key refused',
      at: 5,
    });
  });

  it('files anything else under SERVER', () => {
    expect(toErrorEvent(new Error('boom'), 'load', undefined, 1)).toMatchObject({ code: 'SERVER', message: 'boom', status: undefined });
  });
});

it('caps the store at MAX_CLIENT_EVENTS', () => {
  expect(MAX_CLIENT_EVENTS).toBe(200);
});

describe('readLoadOutcome (what the page renders from)', () => {
  it('survives Clear: the log is erasable, the page state is not', () => {
    appendClientEvent(failed('it-IT', 1));
    appendClientEvent(loaded('en-US', 2));
    clearClientEvents();
    expect(readLoadOutcome('it-IT')?.kind).toBe('error');
    expect(readLoadOutcome('en-US')?.kind).toBe('loaded');
    expect(readLoadOutcome('de-DE')).toBeUndefined();
  });

  it('survives eviction from the capped log', () => {
    appendClientEvent(failed('fr-FR', 1));
    for (let index = 0; index < MAX_CLIENT_EVENTS + 5; index += 1) appendClientEvent(loaded('en-US', 10 + index));
    expect(readLoadOutcome('fr-FR')?.kind).toBe('error');
  });

  it('is replaced by the next load outcome for that locale and ignores other kinds', () => {
    appendClientEvent(failed('es-ES', 1));
    appendClientEvent({ kind: 'changed', locale: 'es-ES', keys: 3, at: 2 });
    appendClientEvent({ kind: 'error', locale: 'es-ES', phase: 'revalidate', code: 'RATE_LIMITED', status: 429, message: 'x', at: 3 });
    expect(readLoadOutcome('es-ES')?.kind).toBe('error');
    appendClientEvent(loaded('es-ES', 4));
    expect(readLoadOutcome('es-ES')?.kind).toBe('loaded');
  });
});
