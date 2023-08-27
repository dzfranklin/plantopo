import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT = 200;

export function useSidebarWidth(): [number, (_: number) => void] {
  const [value, _setValue] = useState(DEFAULT);

  useEffect(() => {
    const value = localStorage.getItem('sidebarWidth');
    if (value) {
      _setValue(JSON.parse(value));
    }
  }, []);

  const pendingSave = useRef<number | null>(null);
  const setValue = useCallback((value: number) => {
    if (pendingSave.current !== null) {
      cancelIdleCallback(pendingSave.current);
    }
    pendingSave.current = requestIdleCallback(() => {
      pendingSave.current = null;
      localStorage.setItem('sidebarWidth', JSON.stringify(value));
    });
    _setValue(value);
  }, []);

  return [value, setValue];
}
