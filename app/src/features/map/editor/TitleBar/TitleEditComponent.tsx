import { useMapMeta, usePutMapMetaMutation } from '../../api/mapMeta';
import { useMapId } from '../useMapId';
import { useEffect, useState } from 'react';
import cls from '@/generic/cls';

export function TitleEditComponent() {
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [value, setValue] = useState<string>('');
  const mutation = usePutMapMetaMutation(mapId);
  useEffect(() => {
    if (meta.data) setValue(meta.data.name);
  }, [meta.data]);
  return (
    <input
      className={cls(
        'grow px-1 py-0.5 bg-neutral-100 rounded outline-none border border-transparent',
        'font-normal text-sm',
        'hover:border-neutral-500 active:border-neutral-500 focus:border-neutral-500 focus:ring-0',
      )}
      placeholder={meta.data ? 'Unnamed map' : 'Loading...'}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== meta.data?.name) {
          mutation.mutate({ name: value });
        }
      }}
    />
  );
}
