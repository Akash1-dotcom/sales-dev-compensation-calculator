import { useEffect, useState } from 'react';

/**
 * Small localStorage-backed state hook. Used to persist saved "what-if"
 * scenarios (for side-by-side comparison) across page reloads without
 * requiring any backend.
 */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable (e.g. private browsing) - fail silently.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
