import type { ClientErrorEvent } from '../diagnostics/client-events';

/** The package maps every HTTP outcome to a `TranslifyError` code; the card speaks in those. */
const describe = (event: ClientErrorEvent): string => {
  switch (event.code) {
    case 'UNAUTHORIZED':
      return 'Rejected: the delivery key is missing, revoked or not a publishable key.';
    case 'NOT_FOUND':
      return 'Not found: the project slug does not match the key, or the environment or locale is unknown, archived, or disabled.';
    case 'NETWORK':
      return 'Network or CORS failure — indistinguishable from JavaScript. Check the browser console.';
    default:
      return `Delivery failed: ${event.code}.`;
  }
};

export const DeliveryErrorCard = ({ event }: { event: ClientErrorEvent }): React.ReactNode => (
  <div className="rounded border border-red-200 bg-red-50 p-4">
    <h2 className="font-semibold text-red-900">Bundle did not load</h2>
    <p className="mt-1 text-sm text-red-800">{describe(event)}</p>
    <p className="mt-2 font-mono text-xs text-red-700">
      {event.code}
      {event.status === undefined ? '' : ` · ${event.status}`}
      {` · ${event.message}`}
    </p>
  </div>
);
