import { useMemo } from 'react';
import { parse as parseCookie } from 'cookie';

export function useCookies(): Record<string, string> {
  return useMemo(() => {
    if (!('document' in globalThis)) return {};
    return parseCookie(document.cookie);
  }, []);
}
