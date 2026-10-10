import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18next, { type i18n } from 'i18next';
import ICU from 'i18next-icu';
import { appendMissingKey } from './diagnostics/exchange-log';
import { I18N_OPTIONS, translateAndDiagnose } from './i18n';

vi.mock('./diagnostics/exchange-log', () => ({ appendMissingKey: vi.fn() }));

beforeEach(() => {
  vi.mocked(appendMissingKey).mockClear();
});

const makeInstance = async (): Promise<i18n> => {
  const instance = i18next.createInstance();
  await instance.use(ICU).init({
    ...I18N_OPTIONS(['en-US', 'it-IT']),
    resources: {
      'en-US': { cart: { cartTitle: 'Your cart', itemCount: '{count, plural, one {{count} item} other {{count} items}}' } },
      'it-IT': { cart: { cartTitle: 'Il tuo carrello', itemCount: '{count, plural, one {{count} articolo} other {{count} articoli}}' } },
    },
  });

  return instance;
};

describe('i18n options', () => {
  it('formats the ICU plural the catalog stores, including zero', async () => {
    const instance = await makeInstance();
    expect(instance.t('itemCount', { count: 0 })).toBe('0 items');
    expect(instance.t('itemCount', { count: 1 })).toBe('1 item');
    expect(instance.t('itemCount', { count: 3 })).toBe('3 items');
    await instance.changeLanguage('it-IT');
    expect(instance.t('itemCount', { count: 1 })).toBe('1 articolo');
    expect(instance.t('itemCount', { count: 0 })).toBe('0 articoli');
  });

  it('a zero count is a translation, not a missing key', async () => {
    const instance = await makeInstance();
    const t = (key: string, options?: Record<string, unknown>): string => instance.t(key, options);
    expect(translateAndDiagnose(instance, t, 'itemCount', { count: 0 })).toBe('0 items');
    await instance.changeLanguage('it-IT');
    expect(translateAndDiagnose(instance, t, 'itemCount', { count: 0 })).toBe('0 articoli');
    expect(appendMissingKey).not.toHaveBeenCalled();
  });

  it('reads bare catalog keys from the cart namespace', async () => {
    const instance = await makeInstance();
    expect(instance.t('cartTitle')).toBe('Your cart');
    expect(instance.t('cart:cartTitle')).toBe('Your cart');
  });

  it('translateAndDiagnose passes ICU options through', async () => {
    const instance = await makeInstance();
    const t = (key: string, options?: Record<string, unknown>): string => instance.t(key, options);
    expect(translateAndDiagnose(instance, t, 'itemCount', { count: 2 })).toBe('2 items');
  });
});
