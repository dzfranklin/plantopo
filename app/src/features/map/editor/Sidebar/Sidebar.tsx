import { useRef } from 'react';
import { FeatureTree } from './FeatureTree';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from './ResizeHandle';
import cls from '@/generic/cls';
import { useEngine, useSceneSelector } from '../engine/useEngine';

export default function Sidebar() {
  const engine = useEngine();
  const width = useSceneSelector((s) => s.sidebarWidth);
  const rootRef = useRef<HTMLDivElement>(null);

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
            'border-r border-neutral-300',
          )}
        >
          <Toolbar />

          {engine && <FeatureTree engine={engine} />}
        </div>

        <ResizeHandle />
      </div>
    </>
  );
}
