import { useCallback, useEffect, useState } from 'react';

// Один стан завантаження/помилки/даних для всіх сторінок, які читають дані з API
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));
    run()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => reload(), [reload]);

  return { ...state, reload };
}
