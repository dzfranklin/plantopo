import { SyncEngine } from '../api/SyncEngine';
import {
  DragEventHandler,
  RefObject,
  UIEventHandler,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import AddAtIcon from '@spectrum-icons/workflow/Add';
import cls from '@/generic/cls';
import './FeatureTree.css';
import { nameForUnnamedFeature } from '../api/SyncEngine/Scene';
import { FeatureTreeFeatureEditButton } from './FeatureTreeFeatureEditButton';
import { useSceneFeature, useSceneSelector } from '../api/useEngine';
import { shallowArrayEq } from '@/generic/equality';

const CHILD_INDENT_PX = 16;
const VERTICAL_GAP_PX = 2;
const INDICATOR_BORDER_PX = 2;

interface DragTarget {
  at: 'before' | 'after' | 'firstChild';
  target: number;
  elem: HTMLElement;
}

export function FeatureTree({ engine }: { engine: SyncEngine }) {
  const rootRef = useRef<HTMLUListElement>(null);
  const dragAtElemRef = useRef<HTMLDivElement>(null);

  const { onDragStart, onDragEnd, onDragOver, onDragEnter, onDrop, onScroll } =
    useFeatureTreeInteractivity({ engine, rootRef, dragAtElemRef });

  useEffect(() => {
    const l = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') engine.fClearMySelection();
    };
    window.addEventListener('keyup', l);
    return () => window.removeEventListener('keyup', l);
  }, [engine]);

  const children = useSceneSelector(
    (s) => s.features.root.children.map((f) => f.id),
    shallowArrayEq,
  );

  return (
    <ul
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      className="grow overflow-y-auto pt-0.5 pb-10"
      onScroll={onScroll}
      ref={rootRef}
    >
      {children.map((child) => (
        <Entry key={child} fid={child} engine={engine} />
      ))}

      <div ref={dragAtElemRef} className="z-20 drag-at-marker">
        <div className="flex items-center h-3 gap-1 mr-2 text-white">
          <hr className="flex-grow border-0 h-[1.5px] bg-blue-500" />
          <AddAtIcon
            height="0.75rem"
            UNSAFE_className="h-3 rounded-full bg-blue-500"
          />
        </div>
      </div>
    </ul>
  );
}

function useFeatureTreeInteractivity({
  engine,
  rootRef,
  dragAtElemRef,
}: {
  engine: SyncEngine;
  rootRef: RefObject<HTMLUListElement>;
  dragAtElemRef: RefObject<HTMLDivElement>;
}): {
  onDragStart: DragEventHandler<HTMLUListElement>;
  onDrop: DragEventHandler<HTMLUListElement>;
  onDragEnd: DragEventHandler<HTMLUListElement>;
  onDragEnter: DragEventHandler<HTMLUListElement>;
  onDragOver: DragEventHandler<HTMLUListElement>;
  onScroll: UIEventHandler<HTMLUListElement>;
} {
  const dragTargetRef = useRef<DragTarget | null>(null);

  const onDragStart = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (!engine.canEdit) return;
      const rootElem = rootRef.current;
      const dragAtElem = dragAtElemRef.current;
      if (!rootElem || !dragAtElem) return;

      if (!(evt.target instanceof HTMLElement)) return;
      if (evt.target.dataset.fid === undefined) return;
      const dragTargetId = parseInt(evt.target.dataset.fid, 10);

      // Add the dragged element to targets if necessary
      let dragTargetIncluded = engine.fIsSelectedByMe(dragTargetId);
      if (!dragTargetIncluded) {
        dragTargetIncluded = engine.fHasAncestorSelectedByMe(dragTargetId);
      }
      if (!dragTargetIncluded) {
        if (evt.shiftKey) {
          engine.fAddToMySelection(dragTargetId);
        } else {
          engine.startTransaction();
          engine.fClearMySelection();
          engine.fAddToMySelection(dragTargetId);
          engine.commitTransaction();
        }
      }

      evt.dataTransfer.effectAllowed = 'move';
      // evt.dataTransfer.setData('text/plain', selected.join(','));
      evt.dataTransfer.setData('x-pt/features', 'selected');
      // Hide ghost as won't reflect what is actually being dragged
      evt.dataTransfer.setDragImage(new Image(), 0, 0);

      const targetElem = evt.target;
      requestAnimationFrame(() => {
        const targetRect = targetElem.getBoundingClientRect();
        rootElem.classList.add('dragging');
        positionDragAtMarker(dragAtElem, targetRect, 'after', false);
      });
    },
    [dragAtElemRef, engine, rootRef],
  );

  const onDragEnter = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (!engine.canEdit) return;
      if (evt.dataTransfer.types.includes('x/pt')) {
        return;
      }
      evt.preventDefault();
    },
    [engine.canEdit],
  );

  const onDragOver = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (!engine.canEdit) return;
      if (evt.dataTransfer.types.includes('x/pt')) {
        return;
      }

      const rootElem = rootRef.current;
      const dragAtElem = dragAtElemRef.current;
      if (!rootElem || !dragAtElem) return;

      const rootRect = rootElem.getBoundingClientRect();

      let targetElem = document.elementFromPoint(
        rootRect.right - 20, // Subtract out potential scrollbar width
        evt.clientY,
      );
      if (!(targetElem instanceof HTMLElement)) return;
      while (targetElem.dataset.fid === undefined) {
        targetElem = targetElem.parentElement;
        if (!(targetElem instanceof HTMLElement)) return;
      }

      const targetId = parseInt(targetElem.dataset.fid, 10);

      let targetPlace: DragTarget['at'];
      const targetRect = targetElem.getBoundingClientRect();
      if (evt.clientY > targetRect.bottom - targetRect.height / 3) {
        targetPlace = 'after';
      } else if (evt.clientY < targetRect.top + targetRect.height / 3) {
        targetPlace = 'before';
      } else {
        targetPlace = 'firstChild';
      }

      dragTargetRef.current = {
        target: targetId,
        elem: targetElem,
        at: targetPlace,
      };

      positionDragAtMarker(dragAtElem, targetRect, targetPlace, true);

      evt.preventDefault();
    },
    [dragAtElemRef, engine.canEdit, rootRef],
  );

  const onDrop = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (!engine.canEdit) return;
      const target = dragTargetRef.current;
      if (
        evt.dataTransfer.getData('x-pt/features') !== 'selected' ||
        target === null
      ) {
        return;
      }
      const targetNode = engine.getFeature(target.target);
      if (!targetNode) return;

      engine.startTransaction();
      engine.fMoveSelectedByMe({
        at: target.at,
        target: targetNode,
      });
      engine.fClearMySelection();
      engine.commitTransaction();

      dragTargetRef.current = null;
      rootRef.current?.classList.remove('dragging');
      evt.preventDefault();
    },
    [engine, rootRef],
  );

  const onDragEnd = useCallback<DragEventHandler<HTMLUListElement>>(
    (_evt) => {
      rootRef.current?.classList.remove('dragging');
    },
    [rootRef],
  );

  const dragMarkerDirty = useRef(false);
  const maybeDirtyDragMarker = useCallback(() => {
    if (dragTargetRef.current && !dragMarkerDirty.current) {
      dragMarkerDirty.current = true;

      requestAnimationFrame(() => {
        const target = dragTargetRef.current;
        if (!target || !dragAtElemRef.current) return;

        const targetRect = target.elem.getBoundingClientRect();
        positionDragAtMarker(
          dragAtElemRef.current,
          targetRect,
          target.at,
          false,
        );

        dragMarkerDirty.current = false;
      });
    }
  }, [dragAtElemRef]);

  const onScroll = useCallback<UIEventHandler<HTMLUListElement>>(
    (_evt) => maybeDirtyDragMarker(),
    [maybeDirtyDragMarker],
  );

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new ResizeObserver((_entries) => maybeDirtyDragMarker());
    observer.observe(rootRef.current);
    () => observer.disconnect();
  }, [maybeDirtyDragMarker, rootRef]);

  return { onDragStart, onDrop, onDragEnd, onDragEnter, onDragOver, onScroll };
}

function positionDragAtMarker(
  dragAtElem: HTMLDivElement,
  targetRect: DOMRect,
  targetPlace: DragTarget['at'],
  animate: boolean,
) {
  const markerHeight = dragAtElem.getBoundingClientRect().height;

  let toY;
  if (targetPlace === 'before') {
    toY = targetRect.top - markerHeight / 2;
  } else {
    toY = targetRect.bottom - markerHeight / 2;
  }

  let toX = targetRect.left + INDICATOR_BORDER_PX;
  let toWidth = targetRect.width - INDICATOR_BORDER_PX;
  if (targetPlace === 'firstChild') {
    toX += CHILD_INDENT_PX;
    toWidth -= CHILD_INDENT_PX;
  }

  if (animate) {
    dragAtElem.classList.add('animate');
  } else {
    dragAtElem.classList.remove('animate');
  }
  dragAtElem.style.width = `${toWidth}px`;
  dragAtElem.style.transform = `translateX(${toX}px) translateY(${toY}px)`;
}

interface Entry {
  id: number;
  children: Entry[];
  ancestors: number[];
}

function Entry({ fid, engine }: { fid: number; engine: SyncEngine }) {
  const name = useSceneFeature(fid, (f) =>
    f ? f.name ?? nameForUnnamedFeature(f) : null,
  );
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
          <span className="flex-grow select-none text-start">{name}</span>
          <FeatureTreeFeatureEditButton engine={engine} fid={fid} />
          <FeatureChildren engine={engine} fid={fid} />
        </div>
      </div>
    </li>
  );
}

function FeatureChildren({ fid, engine }: { fid: number; engine: SyncEngine }) {
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
        <Entry key={child} fid={child} engine={engine} />
      ))}
    </ul>
  );
}
