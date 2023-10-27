import { ActionButton } from '@adobe/react-spectrum';
import FolderAddIcon from '@spectrum-icons/workflow/FolderAdd';
import { useEngine } from '../engine/useEngine';

export function TreeToolbar() {
  const engine = useEngine();

  return (
    <div className="flex items-center justify-end min-w-0 p-1 m-1 rounded bg-neutral-200">
      <ActionButton
        isQuiet
        isDisabled={!engine}
        onPress={() => {
          engine?.createFeature();
        }}
      >
        <FolderAddIcon />
      </ActionButton>
    </div>
  );
}
