import { useRef } from 'react';
import { FInsertPlace, SyncEngine } from '../api/SyncEngine';
import { FeatureTree } from './FeatureTree';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from './ResizeHandle';
import cls from '@/generic/cls';
import { useSync } from '../api/useSync';

export default function Sidebar({
  width,
  setWidth,
}: {
  width: number;
  setWidth: (_: number) => void;
}) {
  const { engine } = useSync();
  const rootRef = useRef<HTMLDivElement>(null);
  const insertAt = useRef<FInsertPlace>({ at: 'firstChild', target: 0 });

  return (
    <>
      <div
        ref={rootRef}
        className={cls(
          'absolute bottom-0 left-0 flex flex-row',
          'top-[-1px]', // Cover up titlebar border
        )}
        style={{ width: `${width}px` }}
      >
        <div
          className={cls(
            'flex flex-col w-full min-w-0 bg-neutral-100',
            // Visually appears to connect to titlebar border
            'border-r border-neutral-400',
          )}
        >
          <Toolbar insertAt={insertAt} />

          {engine && <FeatureTree insertAt={insertAt} engine={engine} />}
        </div>

        <ResizeHandle setWidth={setWidth} />
      </div>
    </>
  );
}
