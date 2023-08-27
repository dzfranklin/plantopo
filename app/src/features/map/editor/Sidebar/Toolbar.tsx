import { MutableRefObject } from 'react';
import { FInsertPlace } from '../api/SyncEngine';
import { ActionButton } from '@adobe/react-spectrum';
import FolderAddIcon from '@spectrum-icons/workflow/FolderAdd';
import { useSync } from '../api/useSync';

export function Toolbar({
  insertAt,
}: {
  insertAt: MutableRefObject<FInsertPlace>;
}) {
  const { engine } = useSync();

  return (
    <div className="flex items-center justify-end min-w-0 p-1 m-1 rounded bg-neutral-200">
      <ActionButton
        isQuiet
        isDisabled={!engine}
        onPress={() => {
          engine?.fCreate(insertAt.current);
        }}
      >
        <FolderAddIcon />
      </ActionButton>
    </div>
  );
}
