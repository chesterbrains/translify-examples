import { describe, expect, it } from 'vitest';
import { TranslifyError } from '@translifyhq/client';
import { lastLoadOutcome, MAX_CLIENT_EVENTS, toErrorEvent, type ClientEvent } from './client-events';

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

describe('lastLoadOutcome', () => {
  it('follows the asked locale, not the newest event', () => {
    const events = [loaded('en-US', 1), failed('it-IT', 2), loaded('en-US', 3)];
    expect(lastLoadOutcome(events, 'it-IT')?.kind).toBe('error');
    expect(lastLoadOutcome(events, 'en-US')?.at).toBe(3);
    expect(lastLoadOutcome(events, 'de-DE')).toBeUndefined();
  });

  it('ignores revalidate errors and changed/revalidated rows', () => {
    const events: ClientEvent[] = [
      loaded('it-IT', 1),
      { kind: 'error', locale: 'it-IT', phase: 'revalidate', code: 'RATE_LIMITED', status: 429, message: 'x', at: 2 },
      { kind: 'changed', locale: 'it-IT', keys: 3, at: 3 },
      { kind: 'revalidated', locale: 'it-IT', changed: false, ms: 1, at: 4 },
    ];
    expect(lastLoadOutcome(events, 'it-IT')?.kind).toBe('loaded');
  });
});

it('caps the store at MAX_CLIENT_EVENTS', () => {
  expect(MAX_CLIENT_EVENTS).toBe(200);
});
