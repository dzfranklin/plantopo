import { Content, Dialog, TextField } from '@adobe/react-spectrum';
import { useSceneFeature } from '../../engine/useEngine';
import { EditorEngine } from '../../engine/EditorEngine';

export function FeatureEditPopover({
  fid,
  engine,
}: {
  fid: string;
  engine: EditorEngine;
}) {
  const name = useSceneFeature(fid, (f) => f?.name ?? '');
  return (
    <Dialog height="10rem" width="20rem">
      <Content>
        <TextField
          label="Name"
          value={name}
          width="100%"
          onChange={(value) => engine.changeFeature({ id: fid, name: value })}
        />
      </Content>
    </Dialog>
  );
}
