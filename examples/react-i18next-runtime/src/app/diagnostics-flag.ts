/**
 * The drawer and its probes are a developer tool, not the example. They mount only
 * when asked for: `?diagnostics` in the URL, or `VITE_DIAGNOSTICS=1` at build time.
 */
export const diagnosticsEnabled = (search: string, env: Record<string, string | undefined>): boolean =>
  new URLSearchParams(search).has('diagnostics') || env.VITE_DIAGNOSTICS === '1';
