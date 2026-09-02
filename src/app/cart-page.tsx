import { useTranslation } from 'react-i18next';

/** The demo's real surface: three seeded keys under the `cart` namespace. */
export const CartPage = (): React.ReactNode => {
  const { t } = useTranslation();

  return (
    <section className="rounded border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold">{t('cart.title')}</h2>
      <p className="mt-4 text-sm text-neutral-600">{t('cart.empty.cta')}</p>
      <div className="mt-6 flex justify-between border-t border-neutral-200 pt-3 text-sm">
        <span>{t('cart.totals.total')}</span>
        <span className="font-mono">0,00 &euro;</span>
      </div>
    </section>
  );
};
