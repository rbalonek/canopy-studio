import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { mockDataProvider } from './mockProvider';
import type { DataProvider } from './provider';

const DataContext = createContext<DataProvider>(mockDataProvider);

export function DataProviderProvider({
  children,
  provider = mockDataProvider,
}: {
  children: ReactNode;
  provider?: DataProvider;
}) {
  return <DataContext.Provider value={provider}>{children}</DataContext.Provider>;
}

export function useDataProvider(): DataProvider {
  return useContext(DataContext);
}

/**
 * Tiny query hook. Re-runs when deps change; returns loading/error/data.
 * Deliberately minimal — swap for react-query later if we need cache/invalidation.
 */
export function useQuery<T>(
  fetcher: (p: DataProvider) => Promise<T>,
  deps: unknown[] = [],
): { data: T | undefined; loading: boolean; error: Error | null } {
  const provider = useDataProvider();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current(provider)
      .then((v) => {
        if (!cancelled) {
          setData(v);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, ...deps]);

  return { data, loading, error };
}
