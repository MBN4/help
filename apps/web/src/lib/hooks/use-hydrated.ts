import * as React from 'react';

const subscribe = (): (() => void) => () => undefined;

/**
 * `false` during SSR and the hydration render, `true` afterwards. Use it to hold back text that depends on
 * client-fetched data (react-query cache) so the first client render matches the server HTML — e.g. a Radix
 * `SelectValue` label looked up from a cached list.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
