import { Dispatch, SetStateAction, useRef } from 'react';
import { FInsertPlace, SyncEngine } from '@/sync/SyncEngine';
import { EditStartChannel } from '../EditStartChannel';
import { FeatureTree } from './FeatureTree';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from './ResizeHandle';

export default function Sidebar({
  engine,
  mapName,
  editStart,
  width,
  setWidth,
}: {
  engine: SyncEngine;
  mapName: string;
  editStart: EditStartChannel;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const insertAt = useRef<FInsertPlace>({ at: 'firstChild', target: 0 });

  return (
    <>
      <div
        ref={rootRef}
        className="absolute top-0 bottom-0 left-0 flex flex-row"
        style={{ width: `${width}px` }}
      >
        <div className="flex flex-col w-full min-w-0 bg-slate-100">
          <Toolbar
            mapName={mapName}
            engine={engine}
            insertAt={insertAt}
            editStart={editStart}
            width={width}
          />

          <FeatureTree insertAt={insertAt} engine={engine} />
        </div>

        <ResizeHandle setWidth={setWidth} />
      </div>
    </>
  );
}
