import { useEffect, useRef } from 'react';

/**
 * Custom hook to run a periodic task.
 * Updates are kept stable across renders via useRef.
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    // Trigger on interval
    const id = setInterval(() => {
      void savedCallback.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);
}
