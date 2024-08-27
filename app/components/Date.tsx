import { useState } from 'react';
import { DateTime } from 'luxon';

const fmtDate = (iso: string, locale?: string) => {
  const d = DateTime.fromISO(iso);
  if (locale) d.setLocale(locale);
  return d.toLocaleString(DateTime.DATE_SHORT);
};

export function useFormattedDate(iso: string): string {
  const [v, setV] = useState(() => fmtDate(iso, 'en-US'));
  // TODO:
  // useEffect(() => {
  //   setV(DateTime.fromISO(iso).toLocaleString());
  // }, [iso]);
  return v;
}

export function Date({ iso }: { iso: string }) {
  return useFormattedDate(iso);
}
