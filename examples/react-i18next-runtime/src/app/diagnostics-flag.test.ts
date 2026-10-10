import { describe, expect, it } from 'vitest';
import { diagnosticsEnabled } from './diagnostics-flag';

describe('diagnosticsEnabled', () => {
  it('is off by default', () => {
    expect(diagnosticsEnabled('', {})).toBe(false);
  });
  it('turns on with ?diagnostics in the URL, with or without a value', () => {
    expect(diagnosticsEnabled('?diagnostics', {})).toBe(true);
    expect(diagnosticsEnabled('?foo=1&diagnostics=1', {})).toBe(true);
  });
  it('turns on with VITE_DIAGNOSTICS=1 only — "true" and "yes" are not 1', () => {
    expect(diagnosticsEnabled('', { VITE_DIAGNOSTICS: '1' })).toBe(true);
    expect(diagnosticsEnabled('', { VITE_DIAGNOSTICS: 'true' })).toBe(false);
    expect(diagnosticsEnabled('', { VITE_DIAGNOSTICS: 'yes' })).toBe(false);
  });
});
