import { SyncEngine } from '../../api/SyncEngine';
import { useRef } from 'react';
import cls from '@/generic/cls';
import './FeatureTree.css';
import { nameForUnnamedFeature } from '../../api/SyncEngine/Scene';
import { EntryEditButton } from './EntryEditButton';
import { useSceneFeature } from '../../api/useEngine';
import { shallowArrayEq } from '@/generic/equality';
import { CHILD_INDENT_PX, INDICATOR_BORDER_PX } from './FeatureTree';

const VERTICAL_GAP_PX = 2;

/**
 * NOTE: the handlers in useFeatureTreeInteractivity depend on dom details
 * defined here.
 */

export function TreeEntry({
  fid,
  engine,
}: {
  fid: number;
  engine: SyncEngine;
}) {
  const selectedByMe = useSceneFeature(fid, (f) => f?.selectedByMe);

  return (
    <li
      draggable="true"
      data-fid={fid}
      onClick={(evt) => {
        if (evt.shiftKey) {
          engine.fToggleSelectedByMe(fid);
        } else {
          if (engine.fIsSelectedByMe(fid)) {
            engine.fClearMySelection();
          } else {
            engine.fReplaceMySelection(fid);
          }
        }
        evt.stopPropagation();
      }}
      className={cls(selectedByMe && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div className={cls(selectedByMe && 'bg-blue-100')}>
        <div
          className={cls(
            'flex flex-row justify-start w-full gap-1 px-1 text-sm',
          )}
          style={{
            paddingTop: `${VERTICAL_GAP_PX}px`,
            borderLeft: `${INDICATOR_BORDER_PX}px`,
          }}
        >
          <EntryItself fid={fid} engine={engine} />
          <EntryChildren engine={engine} fid={fid} />
        </div>
      </div>
    </li>
  );
}

function EntryItself({ fid, engine }: { fid: number; engine: SyncEngine }) {
  const name = useSceneFeature(fid, (f) =>
    f ? f.name ?? nameForUnnamedFeature(f) : null,
  );

  return (
    <>
      <span className="flex-grow select-none text-start">{name}</span>
      <EntryEditButton engine={engine} fid={fid} />
    </>
  );
}

function EntryChildren({ fid, engine }: { fid: number; engine: SyncEngine }) {
  const children = useSceneFeature(
    fid,
    (f) => f?.children?.map((f) => f.id),
    shallowArrayEq,
  );
  const prev = useRef<any>(children);
  // console.log('FeatureChildren rerender', fid, children === prev.current);
  prev.current = children;
  if (!children || children.length === 0) return null;
  return (
    <ul style={{ paddingLeft: `${CHILD_INDENT_PX}px` }}>
      {children.map((child) => (
        <TreeEntry key={child} fid={child} engine={engine} />
      ))}
    </ul>
  );
}
