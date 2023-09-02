import { SyncEngine } from '../api/SyncEngine';
import {
  DragEventHandler,
  UIEventHandler,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import AddAtIcon from '@spectrum-icons/workflow/Add';
import cls from '@/generic/cls';
import './FeatureTree.css';
import { useScene } from '../api/useScene';
import { SceneFeature, nameForUnnamedFeature } from '../api/SyncEngine/Scene';

const CHILD_INDENT_PX = 16;
const VERTICAL_GAP_PX = 2;
const INDICATOR_BORDER_PX = 2;

interface DragTarget {
  at: 'before' | 'after' | 'firstChild';
  target: number;
  elem: HTMLElement;
}

export function FeatureTree({ engine }: { engine: SyncEngine }) {
  const dragTargetRef = useRef<DragTarget | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);
  const dragAtElemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') engine.fClearMySelection();
    };
    window.addEventListener('keyup', l);
    return () => window.removeEventListener('keyup', l);
  }, [engine]);

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
    [engine],
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
    [engine.canEdit],
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
      const targetNode = engine.fLookupSceneNode(target.target);
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
    [engine],
  );

  const onDragEnd = useCallback<DragEventHandler<HTMLUListElement>>((_evt) => {
    rootRef.current?.classList.remove('dragging');
  }, []);

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
  }, []);

  const onScroll = useCallback<UIEventHandler<HTMLUListElement>>(
    (_evt) => maybeDirtyDragMarker(),
    [maybeDirtyDragMarker],
  );

  useEffect(() => {
    if (!rootRef.current) return;
    const observer = new ResizeObserver((_entries) => maybeDirtyDragMarker());
    observer.observe(rootRef.current);
    () => observer.disconnect();
  }, [maybeDirtyDragMarker]);

  const root = useScene((s) => s.features.root.children);

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
      {root.map((child) => (
        <Entry key={child.id} feature={child} engine={engine} />
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

function Entry({
  feature,
  engine,
}: {
  feature: SceneFeature;
  engine: SyncEngine;
}) {
  return (
    <li
      draggable="true"
      data-fid={feature.id}
      onClick={(evt) => {
        if (evt.shiftKey) {
          engine.fToggleSelectedByMe(feature.id);
        } else {
          if (engine.fIsSelectedByMe(feature.id)) {
            engine.fClearMySelection();
          } else {
            engine.fReplaceMySelection(feature.id);
          }
        }
        evt.stopPropagation();
      }}
      className={cls(feature.selectedByMe && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div className={cls(feature.selectedByMe && 'bg-blue-100')}>
        <div
          className={cls(
            'flex flex-row justify-start w-full gap-1 px-1 text-sm',
          )}
          style={{
            paddingTop: `${VERTICAL_GAP_PX}px`,
            borderLeft: `${INDICATOR_BORDER_PX}px`,
          }}
        >
          <span className="flex-grow select-none text-start">
            {feature.name || nameForUnnamedFeature(feature)}
          </span>
        </div>

        {feature.children.length > 0 && (
          <ul style={{ paddingLeft: `${CHILD_INDENT_PX}px` }}>
            {feature.children.map((child) => (
              <Entry key={child.id} feature={child} engine={engine} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
