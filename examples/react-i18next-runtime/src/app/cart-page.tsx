import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateAndDiagnose } from '../i18n';

/** The real surface: every catalog key, rendered the way Translify stores it (ICU included). */
export const CartPage = (): React.ReactNode => {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(1);
  const d = (key: string, options?: Record<string, unknown>): string =>
    translateAndDiagnose(i18n, (k, o) => String(t(k, o)), key, options);

  return (
    <section className="rounded border border-neutral-200 p-6">
      <p className="text-sm text-neutral-500">{d('greeting', { name: 'Alex' })}</p>
      <h2 className="mt-1 text-lg font-semibold">{d('cartTitle')}</h2>

      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded border px-2"
          onClick={() => setCount(Math.max(0, count - 1))}
          aria-label="fewer"
        >
          −
        </button>
        <span className="min-w-24 text-center" data-testid="item-count">
          {d('itemCount', { count })}
        </span>
        <button type="button" className="rounded border px-2" onClick={() => setCount(count + 1)} aria-label="more">
          +
        </button>
      </div>

      {count === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">{d('emptyCta')}</p>
      ) : (
        <div className="mt-6 flex justify-between border-t border-neutral-200 pt-3 text-sm">
          <span>{d('totalsTotal')}</span>
          <span className="font-mono">{(count * 12.5).toFixed(2)} €</span>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button type="button" className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">
          {d('checkout')}
        </button>
        <button type="button" className="rounded border border-neutral-300 px-3 py-1 text-sm">
          {d('continueShopping')}
        </button>
      </div>
    </section>
  );
};
