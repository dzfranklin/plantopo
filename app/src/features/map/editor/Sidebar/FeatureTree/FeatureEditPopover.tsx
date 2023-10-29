import { Content, Dialog } from '@adobe/react-spectrum';
import { useSceneFeature } from '../../engine/useEngine';
import { EditorEngine } from '../../engine/EditorEngine';
import { useId } from 'react';

export function FeatureEditPopover({
  fid,
  engine,
}: {
  fid: string;
  engine: EditorEngine;
}) {
  const name = useSceneFeature(fid, (f) => f?.name ?? '');
  const nameInputId = useId();
  return (
    <Dialog height="10rem" width="20rem">
      <Content>
        <label htmlFor={nameInputId}>Name</label>
        <input
          id={nameInputId}
          value={name}
          width="100%"
          onChange={(evt) =>
            engine.changeFeature({ id: fid, name: evt.target.value })
          }
          onKeyDown={(evt) => evt.stopPropagation()}
        />
      </Content>
    </Dialog>
  );
}
