import type { DeliveryExchange } from '../translify/types';

const describe = (exchange: DeliveryExchange): string => {
  if (exchange.outcome.kind === 'network') {
    return 'Network or CORS failure — indistinguishable from JavaScript. Check the browser console.';
  }
  if (exchange.outcome.status === 401) return 'Rejected: the API key is missing, unknown, or revoked.';
  if (exchange.outcome.status === 404) {
    return 'Not found: the project slug does not match the key, or the environment or locale is unknown, archived, or disabled.';
  }

  return `Delivery returned ${exchange.outcome.status}.`;
};

export const DeliveryErrorCard = ({ exchange }: { exchange: DeliveryExchange }): React.ReactNode => (
  <div className="rounded border border-red-200 bg-red-50 p-4">
    <h2 className="font-semibold text-red-900">Bundle did not load</h2>
    <p className="mt-1 text-sm text-red-800">{describe(exchange)}</p>
    <p className="mt-2 font-mono text-xs text-red-700">{exchange.path}</p>
  </div>
);
