import { useEffect, useState } from 'react';
import { DateTime as LuxonDateTime } from 'luxon';

const fmtDate = (
  iso: string,
  fmt: Intl.DateTimeFormatOptions,
  locale?: string,
) => {
  let d = LuxonDateTime.fromISO(iso);
  if (locale) d = d.setLocale(locale);
  return d.toLocaleString(fmt);
};

export function useFormattedTimestamp(
  iso: string,
  fmt: Intl.DateTimeFormatOptions = LuxonDateTime.DATE_SHORT,
): string {
  const [v, setV] = useState(() => fmtDate(iso, fmt, 'en-US'));
  useEffect(() => {
    setV(fmtDate(iso, fmt));
  }, [fmt, iso]);
  return v;
}

export function Timestamp({
  iso,
  fmt,
}: {
  iso: string;
  fmt?: Intl.DateTimeFormatOptions;
}) {
  return useFormattedTimestamp(iso, fmt);
}
