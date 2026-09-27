import { useState } from 'react';
import type { DeliveryExchange, TranslifyConfig } from '../translify/types';
import { PROBES, verdictOf, type Verdict } from './probes';
import { clearExchanges, useExchanges, useMissingKeys } from './exchange-log';
import { maskKey } from '../translify/client';

const statusOf = (exchange: DeliveryExchange): string =>
  exchange.outcome.kind === 'network' ? 'network' : String(exchange.outcome.status);

const ExchangeRow = ({ exchange }: { exchange: DeliveryExchange }): React.ReactNode => {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-neutral-200 py-1 font-mono text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full gap-3 text-left">
        <span className="w-16 shrink-0">{statusOf(exchange)}</span>
        <span className="w-40 shrink-0 truncate">{exchange.label}</span>
        <span className="w-16 shrink-0">{Math.round(exchange.ms)}ms</span>
        <span
          className="w-24 shrink-0"
          title={
            exchange.source === 'likely-cache'
              ? 'Inferred from latency. Resource Timing is unavailable cross-origin without Timing-Allow-Origin, which the backend does not send.'
              : undefined
          }
        >
          {exchange.source}
        </span>
        <span className="truncate">{exchange.path}</span>
      </button>
      {open && (
        <pre className="mt-1 overflow-x-auto rounded bg-neutral-100 p-2">
          {exchange.outcome.kind === 'network'
            ? `network or CORS failure — indistinguishable from JavaScript: ${exchange.outcome.message}`
            : JSON.stringify(exchange.outcome.body, null, 2)}
        </pre>
      )}
    </li>
  );
};

export const DiagnosticsDrawer = ({ config }: { config: TranslifyConfig }): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [running, setRunning] = useState<string | undefined>(undefined);
  const exchanges = useExchanges();
  const missingKeys = useMissingKeys();

  const runProbe = async (id: string): Promise<void> => {
    const probe = PROBES.find((entry) => entry.id === id);
    if (probe === undefined) return;
    setRunning(id);
    const results = await probe.run(config);
    setVerdicts((previous) => ({ ...previous, [id]: verdictOf(probe, results) }));
    setRunning(undefined);
  };

  return (
    <section className="rounded border border-neutral-300">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-left text-sm font-semibold"
      >
        {open ? '▾' : '▸'} Diagnostics
      </button>
      {open && (
        <div className="space-y-6 border-t border-neutral-200 p-4">
          <div>
            <h3 className="text-sm font-semibold">Configuration</h3>
            <dl className="mt-1 grid grid-cols-[8rem_1fr] gap-x-4 font-mono text-xs">
              <dt>base URL</dt>
              <dd>{config.baseUrl}</dd>
              <dt>project</dt>
              <dd>{config.projectSlug}</dd>
              <dt>environment</dt>
              <dd>{config.envSlug}</dd>
              <dt>locales</dt>
              <dd>{config.locales.join(', ')}</dd>
              <dt>api key</dt>
              <dd>{maskKey(config.apiKey)}</dd>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Probes</h3>
            <ul className="mt-1 space-y-1">
              {PROBES.map((probe) => (
                <li key={probe.id} className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    disabled={running !== undefined}
                    onClick={() => void runProbe(probe.id)}
                    className="w-56 shrink-0 rounded border border-neutral-300 px-2 py-1 text-left"
                  >
                    {probe.label}
                  </button>
                  <span
                    className={
                      verdicts[probe.id] === 'pass'
                        ? 'w-12 font-semibold text-green-700'
                        : verdicts[probe.id] === 'fail'
                          ? 'w-12 font-semibold text-red-700'
                          : 'w-12 text-neutral-400'
                    }
                  >
                    {verdicts[probe.id] ?? (running === probe.id ? '…' : '—')}
                  </span>
                  <span className="text-neutral-600">{probe.expectation}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Missing keys</h3>
            {missingKeys.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-600">None requested that the bundle did not have.</p>
            ) : (
              <ul className="mt-1 font-mono text-xs">
                {missingKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-neutral-600">
              The response ETag cannot be read here: the backend calls{' '}
              <code>enableCors()</code> with no <code>exposedHeaders</code>, and <code>ETag</code> is
              not CORS-safelisted. Conditional requests and 304s are therefore not observable from a
              browser client.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Exchanges ({exchanges.length})</h3>
              <button
                type="button"
                onClick={clearExchanges}
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
              >
                Clear
              </button>
            </div>
            <ul className="mt-1 max-h-80 overflow-y-auto">
              {[...exchanges].reverse().map((exchange) => (
                <ExchangeRow key={exchange.id} exchange={exchange} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
