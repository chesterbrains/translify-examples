export const SetupScreen = ({ missing }: { missing: string[] }): React.ReactNode => (
  <main className="mx-auto max-w-xl p-8">
    <h1 className="text-xl font-semibold">Configuration incomplete</h1>
    <p className="mt-2 text-sm text-neutral-600">
      Copy <code className="rounded bg-neutral-100 px-1">.env.example</code> to{' '}
      <code className="rounded bg-neutral-100 px-1">.env</code> and set the variables below, then
      restart the dev server — Vite inlines them at build time.
    </p>
    <ul className="mt-4 space-y-1">
      {missing.map((name) => (
        <li key={name} className="rounded bg-red-50 px-3 py-2 font-mono text-sm text-red-800">
          {name}
        </li>
      ))}
    </ul>
  </main>
);
