import { useEffect, useRef } from 'react';
import cls from '@/generic/cls';
import './FeatureTree.css';
import { nameForUnnamedFeature } from '../../engine/Scene';
import { EntryEditButton } from './EntryEditButton';
import { useSceneFeature } from '../../engine/useEngine';
import { shallowArrayEq } from '@/generic/equality';
import { CHILD_INDENT_PX, INDICATOR_BORDER_PX } from './FeatureTree';
import { EditorEngine } from '../../engine/EditorEngine';

const VERTICAL_GAP_PX = 2;

/**
 * NOTE: the handlers in useFeatureTreeInteractivity depend on dom details
 * defined here.
 */

export function TreeEntry({
  fid,
  engine,
}: {
  fid: string;
  engine: EditorEngine;
}) {
  const selectedByMe = useSceneFeature(fid, (f) => f?.selectedByMe);

  return (
    <li
      draggable="true"
      data-fid={fid}
      onClick={(evt) => {
        if (evt.shiftKey) {
          engine.toggleSelection(fid, 'multi');
        } else {
          engine.toggleSelection(fid, 'single');
        }
        evt.stopPropagation();
      }}
      className={cls(selectedByMe && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div className={cls(selectedByMe && 'bg-blue-100')}>
        <EntryItself fid={fid} engine={engine} />
        <EntryChildren engine={engine} fid={fid} />
      </div>
    </li>
  );
}

function EntryItself({ fid, engine }: { fid: string; engine: EditorEngine }) {
  const ref = useRef<HTMLDivElement>(null);

  const name = useSceneFeature(fid, (f) =>
    f ? f.name ?? nameForUnnamedFeature(f) : null,
  );
  const selectedByMe = useSceneFeature(fid, (f) => f?.selectedByMe);

  useEffect(() => {
    if (selectedByMe) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedByMe]);

  return (
    <div
      ref={ref}
      className={cls('flex flex-row justify-start w-full gap-1 px-1 text-sm')}
      style={{
        paddingTop: `${VERTICAL_GAP_PX}px`,
        borderLeft: `${INDICATOR_BORDER_PX}px`,
      }}
    >
      <span className="flex-grow select-none text-start">{name}</span>
      <EntryEditButton engine={engine} fid={fid} />
    </div>
  );
}

function EntryChildren({ fid, engine }: { fid: string; engine: EditorEngine }) {
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
