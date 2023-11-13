import { useMapMeta, usePutMapMetaMutation } from '../../api/mapMeta';
import { useMapId } from '../useMapId';
import { forwardRef, useEffect, useRef, useState } from 'react';
import cls from '@/generic/cls';

export interface Focuser {
  focus(): void;
}

export const TitleEditComponent = forwardRef<Focuser>((_, ref) => {
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [value, setValue] = useState<string>('');
  const mutation = usePutMapMetaMutation(mapId);
  useEffect(() => {
    if (meta.data) setValue(meta.data.name);
  }, [meta.data]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref == null) return;
    if (typeof ref === 'function') {
      ref(inputRef.current);
    } else {
      ref.current = inputRef.current;
    }
  }, [ref]);
  return (
    <form
      className="grow max-w-[40rem]"
      onSubmit={(evt) => {
        evt.preventDefault();
        inputRef.current?.blur();
      }}
    >
      <input
        ref={inputRef}
        className={cls(
          'w-full px-1 py-0.5 bg-neutral-100 rounded outline-none border border-transparent',
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
    </form>
  );
});
TitleEditComponent.displayName = 'TitleEditComponent';
