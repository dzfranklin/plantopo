import { useEffect, useState } from 'react';

export function isMac(): boolean {
  return (
    navigator.platform.startsWith('Mac') || navigator.platform === 'iPhone'
  );
}

export function useIsMac(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    setValue(isMac());
  }, []);
  return value;
}
