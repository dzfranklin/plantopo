import { useEffect, useRef } from 'react';
import cls from '@/generic/cls';
import './FeatureTree.css';
import { nameForUnnamedFeature } from '../../engine/Scene';
import { useEngine, useSceneFeature } from '../../engine/useEngine';
import { shallowArrayEq } from '@/generic/equality';
import { CHILD_INDENT_PX, INDICATOR_BORDER_PX } from './FeatureTree';
import { EntryActionButtons } from './EntryActionButtons';

const VERTICAL_GAP_PX = 2;

/**
 * NOTE: the handlers in useFeatureTreeInteractivity depend on dom details
 * defined here.
 */

export function TreeEntry({ fid }: { fid: string }) {
  const engine = useEngine();
  const selectedByMe = useSceneFeature(fid, (f) => f?.selectedByMe);
  const ref = useRef<HTMLLIElement>(null);
  if (!engine) return null;
  return (
    <li
      ref={ref}
      draggable="true"
      onClick={(evt) => {
        if (!(evt.target instanceof HTMLElement)) return;
        // Otherwise clicking in the edit popover would trigger this
        let targetEntryElem = evt.target;
        while (targetEntryElem !== ref.current) {
          if (!targetEntryElem.parentElement) return;
          targetEntryElem = targetEntryElem.parentElement;
        }

        if (evt.shiftKey) {
          engine.toggleSelection(fid, 'multi');
        } else {
          engine.toggleSelection(fid, 'single');
        }
        evt.stopPropagation();
      }}
      data-fid={fid}
      className={cls(selectedByMe && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div className={cls(selectedByMe && 'bg-blue-100')}>
        <EntryItself fid={fid} />
        <EntryChildren fid={fid} />
      </div>
    </li>
  );
}

function EntryItself({ fid }: { fid: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const name = useSceneFeature(fid, (f) => {
    if (!f) return null;
    if (f.name?.trim() === '') return nameForUnnamedFeature(f);
    return f.name;
  });
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
      <span className="flex-grow truncate select-none text-start">{name}</span>
      {selectedByMe && <EntryActionButtons fid={fid} />}
    </div>
  );
}

function EntryChildren({ fid }: { fid: string }) {
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
        <TreeEntry key={child} fid={child} />
      ))}
    </ul>
  );
}
