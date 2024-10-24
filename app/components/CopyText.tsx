import cls from '@/cls';
import { Tooltip, TooltipRefProps } from 'react-tooltip';
import { useCallback, useId, useRef } from 'react';
import { wait } from '@/time';

export function CopyText({
  value,
  fullWidth,
}: {
  value: string;
  fullWidth?: boolean;
}) {
  const btnID = useId();
  const tooltip = useRef<TooltipRefProps>(null);

  const onClick = useCallback(() => {
    (async () => {
      await navigator.clipboard.writeText(value);

      tooltip.current?.open({
        anchorSelect: '#' + CSS.escape(btnID),
        content: 'Copied!',
      });

      await wait(3000);

      tooltip.current?.close();
    })().catch((err) => console.error(err));
  }, [value, btnID]);

  return (
    <div
      className={cls(
        !fullWidth && 'max-w-[16rem]',
        'flex items-baseline w-full p-2 rounded bg-slate-100',
      )}
    >
      <div className="w-full max-w-full truncate text-sm text-slate-600 select-all">
        {value}
      </div>

      <button
        className="ml-1.5 text-xs rounded p-1 bg-white shadow-sm hover:shadow-lg"
        onClick={onClick}
        id={btnID}
      >
        Copy
      </button>

      <Tooltip
        ref={tooltip}
        imperativeModeOnly={true}
        openEvents={{}}
        closeEvents={{}}
        globalCloseEvents={{}}
      />
    </div>
  );
}
