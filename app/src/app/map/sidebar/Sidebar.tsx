import { Dispatch, SetStateAction, useRef } from 'react';
import { FInsertPlace, SyncEngine } from '@/sync/SyncEngine';
import { EditStartChannel } from '../EditStartChannel';
import { FeatureTree } from './FeatureTree';
import { Toolbar } from './Toolbar';

export default function Sidebar({
  engine,
  mapName,
  editStart,
}: {
  engine: SyncEngine;
  mapName: string;
  editStart: EditStartChannel;
}) {
  const insertAt = useRef<FInsertPlace>({ at: 'firstChild', target: 0 });

  return (
    <div className="h-screen max-h-screen flex flex-col bg-slate-100">
      <Toolbar
        mapName={mapName}
        engine={engine}
        insertAt={insertAt}
        editStart={editStart}
      />

      <FeatureTree insertAt={insertAt} engine={engine} />
    </div>
  );
  );
}
