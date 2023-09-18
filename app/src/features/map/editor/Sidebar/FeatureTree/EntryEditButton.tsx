import {
  ActionButton,
  Dialog,
  DialogTrigger,
  TextField,
} from '@adobe/react-spectrum';
import EditIcon from '@spectrum-icons/workflow/Edit';
import { useSceneFeature } from '../../engine/useEngine';
import { EditorEngine } from '../../engine/EditorEngine';

export function EntryEditButton({
  fid,
  engine,
}: {
  fid: string;
  engine: EditorEngine;
}) {
  return (
    <DialogTrigger type="popover">
      <ActionButton aria-label="edit" isDisabled={!engine.mayEdit} isQuiet>
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
  fid: string;
  engine: EditorEngine;
}) {
  const name = useSceneFeature(fid, (f) => f?.name ?? '');
  return (
    <Dialog height="5rem" width="3rem">
      <TextField
        label="Name"
        value={name}
        onChange={(value) => engine.changeFeature({ id: fid, name: value })}
      />
    </Dialog>
  );
}
