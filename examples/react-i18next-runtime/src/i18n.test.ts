import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18next, { type i18n } from 'i18next';
import { appendMissingKey } from './diagnostics/exchange-log';
import { createIcu, I18N_OPTIONS, translateAndDiagnose } from './i18n';

vi.mock('./diagnostics/exchange-log', () => ({ appendMissingKey: vi.fn() }));

beforeEach(() => {
  vi.mocked(appendMissingKey).mockClear();
});

const makeInstance = async (): Promise<i18n> => {
  const instance = i18next.createInstance();
  await instance.use(createIcu()).init({
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

  it('binds the React re-render to store additions', () => {
    expect(I18N_OPTIONS(['en-US']).react?.bindI18nStore).toBe('added');
  });

  it('renders the new text after a bundle is replaced in the store, ICU included', async () => {
    const instance = await makeInstance();
    expect(instance.t('itemCount', { count: 2 })).toBe('2 items'); // compiled and memoised once
    instance.removeResourceBundle('en-US', 'cart');
    instance.addResourceBundle('en-US', 'cart', {
      cartTitle: 'Basket',
      itemCount: '{count, plural, one {{count} thing} other {{count} things}}',
    });
    expect(instance.t('cartTitle')).toBe('Basket');
    expect(instance.t('itemCount', { count: 2 })).toBe('2 things');
  });

  it('a removed key is gone after a replace, not kept from the old bundle', async () => {
    const instance = await makeInstance();
    instance.removeResourceBundle('en-US', 'cart');
    instance.addResourceBundle('en-US', 'cart', { cartTitle: 'Basket' });
    expect(instance.exists('itemCount')).toBe(false);
  });
});
