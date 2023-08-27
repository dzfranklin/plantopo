import { useRef } from 'react';
import { FInsertPlace, SyncEngine } from '../api/SyncEngine';
import { FeatureTree } from './FeatureTree';
import { Toolbar } from './Toolbar';
import { ResizeHandle } from './ResizeHandle';
import { MapMeta } from '../../api/MapMeta';
import { SyncSocket } from '../api/SyncSocket';

export default function Sidebar({
  socket,
  engine,
  meta,
  width,
  setWidth,
}: {
  socket: SyncSocket;
  engine: SyncEngine;
  meta: MapMeta;
  width: number;
  setWidth: (_: number) => void;
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
            meta={meta}
            socket={socket}
            engine={engine}
            insertAt={insertAt}
            width={width}
          />

          <FeatureTree insertAt={insertAt} engine={engine} />
        </div>

        <ResizeHandle setWidth={setWidth} />
      </div>
    </>
  );
}
