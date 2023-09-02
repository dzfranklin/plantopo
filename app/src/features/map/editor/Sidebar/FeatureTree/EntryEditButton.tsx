import {
  ActionButton,
  Dialog,
  DialogTrigger,
  TextField,
} from '@adobe/react-spectrum';
import { SyncEngine } from '../../api/SyncEngine';
import EditIcon from '@spectrum-icons/workflow/Edit';
import { useSceneFeature } from '../../api/useEngine';

export function EntryEditButton({
  fid,
  engine,
}: {
  fid: number;
  engine: SyncEngine;
}) {
  return (
    <DialogTrigger type="popover">
      <ActionButton aria-label="edit" isDisabled={!engine.canEdit} isQuiet>
        <EditIcon />
      </ActionButton>
      <FeatureEditPopover key={fid} fid={fid} engine={engine} />
    </DialogTrigger>
  );
}

function FeatureEditPopover({
  fid,
  engine,
}: {
  fid: number;
  engine: SyncEngine;
}) {
  const name = useSceneFeature(fid, (f) => f?.name ?? '');
  return (
    <Dialog height="5rem" width="3rem">
      <TextField
        label="Name"
        value={name}
        onChange={(value) => engine.fSetName(fid, value)}
      />
    </Dialog>
  );
}
