import { parseAbsoluteToLocal } from '@internationalized/date';
import { useMemo } from 'react';
import { useDateFormatter } from 'react-aria';

export function DateTimeText({ utc }: { utc: string }) {
  const fmt = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' });
  const formatted = useMemo(() => {
    const value = parseAbsoluteToLocal(utc);
    return fmt.format(value.toDate());
  }, [fmt, utc]);
  return <>{formatted}</>;
}
