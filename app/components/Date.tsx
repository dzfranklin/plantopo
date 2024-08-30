import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

(window as any).DateTime = DateTime;
const fmtDate = (iso: string, locale?: string) => {
  let d = DateTime.fromISO(iso);
  if (locale) d = d.setLocale(locale);
  return d.toLocaleString(DateTime.DATE_SHORT);
};

export function useFormattedDate(iso: string): string {
  const [v, setV] = useState(() => fmtDate(iso, 'en-US'));
  useEffect(() => {
    setV(fmtDate(iso));
  }, [iso]);
  return v;
}

export function Date({ iso }: { iso: string }) {
  return useFormattedDate(iso);
}
