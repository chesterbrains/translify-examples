import { useTranslation } from 'react-i18next';
import { translateAndDiagnose } from '../i18n';

/** The demo's real surface: three seeded keys under the `cart` namespace. */
export const CartPage = (): React.ReactNode => {
  const { t, i18n } = useTranslation();
  const d = (key: string): string => translateAndDiagnose(i18n, t, key);

  return (
    <section className="rounded border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold">{d('cart.title')}</h2>
      <p className="mt-4 text-sm text-neutral-600">{d('cart.empty.cta')}</p>
      <div className="mt-6 flex justify-between border-t border-neutral-200 pt-3 text-sm">
        <span>{d('cart.totals.total')}</span>
        <span className="font-mono">0,00 &euro;</span>
      </div>
    </section>
  );
};
