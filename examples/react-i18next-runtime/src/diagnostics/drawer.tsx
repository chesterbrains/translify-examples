import { useState } from 'react';
import { VERSION } from '@translifyhq/client';
import type { TranslifyConfig } from '../config';
import { maskKey, type DeliveryExchange } from './raw-fetch';
import { PROBES, verdictOf, type Verdict } from './probes';
import { clearExchanges, useExchanges, useMissingKeys } from './exchange-log';
import { clearClientEvents, useClientEvents, type ClientEvent } from './client-events';

const statusOf = (exchange: DeliveryExchange): string =>
  exchange.outcome.kind === 'network' ? 'network' : String(exchange.outcome.status);

/** One line per fact the client reported. Only what the package exposes; no HTTP detail. */
const describeEvent = (event: ClientEvent): string => {
  switch (event.kind) {
    case 'loaded':
      return `loaded ${event.locale} · ${event.keys} keys · ${Math.round(event.ms)} ms`;
    case 'changed':
      return `changed ${event.locale} · ${event.keys} keys`;
    case 'revalidated':
      return `revalidated ${event.locale} · ${event.changed ? 'changed' : 'unchanged'} · ${Math.round(event.ms)} ms`;
    case 'error':
      return `error ${event.phase}${event.locale === undefined ? '' : ` ${event.locale}`} · ${event.code}${
        event.status === undefined ? '' : ` · ${event.status}`
      } · ${event.message}`;
  }
};

const ExchangeRow = ({ exchange }: { exchange: DeliveryExchange }): React.ReactNode => {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-neutral-200 py-1 font-mono text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full gap-3 text-left">
        <span className="w-16 shrink-0">{statusOf(exchange)}</span>
        <span className="w-40 shrink-0 truncate">{exchange.label}</span>
        <span className="w-16 shrink-0">{Math.round(exchange.ms)}ms</span>
        <span className="truncate">{exchange.path}</span>
      </button>
      {open && (
        <pre className="mt-1 overflow-x-auto rounded bg-neutral-100 p-2">
          {exchange.etag === undefined ? '' : `ETag: ${exchange.etag}\n`}
          {exchange.outcome.kind === 'network'
            ? `network or CORS failure — indistinguishable from JavaScript: ${exchange.outcome.message}`
            : JSON.stringify(exchange.outcome.body, null, 2)}
        </pre>
      )}
    </li>
  );
};

interface ProbeRun {
  verdict: Verdict;
  note?: string;
}

export const DiagnosticsDrawer = ({ config }: { config: TranslifyConfig }): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<Record<string, ProbeRun>>({});
  const [running, setRunning] = useState<string | undefined>(undefined);
  const exchanges = useExchanges();
  const missingKeys = useMissingKeys();
  const events = useClientEvents();

  const runProbe = async (id: string): Promise<void> => {
    const probe = PROBES.find((entry) => entry.id === id);
    if (probe === undefined) return;
    setRunning(id);
    const result = await probe.run(config);
    setRuns((previous) => ({
      ...previous,
      [id]: { verdict: verdictOf(probe, result), ...(result.note === undefined ? {} : { note: result.note }) },
    }));
    setRunning(undefined);
  };

  return (
    <section className="rounded border border-neutral-300">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-4 py-2 text-left text-sm font-semibold">
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
              <dt>delivery key</dt>
              <dd>{maskKey(config.apiKey)}</dd>
            </dl>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Client (<code>@translifyhq/client</code> {VERSION}) · {events.length}
              </h3>
              <button type="button" onClick={clearClientEvents} className="rounded border border-neutral-300 px-2 py-1 text-xs">
                Clear
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              What the package reports: <code>load</code> and <code>refresh</code> results, bundle changes from{' '}
              <code>subscribe</code>, background failures from <code>onError</code>. A background revalidation answered
              with <code>304</code> is silent by design; the Network tab shows it.
            </p>
            {events.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-400">Nothing yet.</p>
            ) : (
              <ul className="mt-1 max-h-60 overflow-y-auto font-mono text-xs">
                {[...events].reverse().map((event) => (
                  <li
                    key={event.id}
                    className={`border-b border-neutral-200 py-1 ${event.kind === 'error' ? 'text-red-700' : ''}`}
                  >
                    {describeEvent(event)}
                  </li>
                ))}
              </ul>
            )}
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
          </div>

          <div>
            <h3 className="text-sm font-semibold">Probes</h3>
            <p className="mt-1 text-xs text-neutral-600">
              Raw requests the package gives no way to send: a missing key, a wrong slug, junk query parameters.
              Each one is logged below.
            </p>
            <ul className="mt-1 space-y-1">
              {PROBES.map((probe) => {
                const run = runs[probe.id];

                return (
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
                        run?.verdict === 'pass'
                          ? 'w-12 font-semibold text-green-700'
                          : run?.verdict === 'fail'
                            ? 'w-12 font-semibold text-red-700'
                            : 'w-12 text-neutral-400'
                      }
                    >
                      {run?.verdict ?? (running === probe.id ? '…' : '—')}
                    </span>
                    <span className="text-neutral-600">
                      {probe.expectation}
                      {run?.note === undefined ? '' : ` — observed: ${run.note}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Probe requests ({exchanges.length})</h3>
              <button type="button" onClick={clearExchanges} className="rounded border border-neutral-300 px-2 py-1 text-xs">
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
