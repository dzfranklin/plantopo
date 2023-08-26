import { FInsertPlace, SyncEngine } from '@/api/map/sync/SyncEngine';
import {
  Dispatch,
  DragEventHandler,
  MutableRefObject,
  SetStateAction,
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AddAtIcon from '@spectrum-icons/workflow/Add';
import cls from '@/app/cls';
import './FeatureTree.css';

const CHILD_INDENT_PX = 16;
const VERTICAL_GAP_PX = 2;
const INDICATOR_BORDER_PX = 2;

interface DragTarget extends FInsertPlace {
  elem: HTMLElement;
}

export function FeatureTree({
  engine,
  insertAt,
}: {
  engine: SyncEngine;
  /** mutated by FeatureTree as user selects */
  insertAt: MutableRefObject<FInsertPlace>;
}) {
  const [children, setChildren] = useState(() => engine.fChildOrder(0));
  useEffect(() => {
    engine.addFChildOrderListener(0, setChildren);
    return () => engine.removeFChildOrderListener(0, setChildren);
  }, [engine]);

  const [selected, _setSelected] = useState<number[]>([]);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const setSelected = useCallback(
    (arg: SetStateAction<number[]>) => {
      if (typeof arg === 'function') {
        _setSelected((p) => {
          const v = arg(p);
          const target = v.at(-1) ?? 0;
          insertAt.current = {
            target,
            at: target === 0 ? 'firstChild' : 'after',
          };
          return v;
        });
      } else {
        const target = arg.at(-1) ?? 0;
        insertAt.current = {
          target,
          at: target === 0 ? 'firstChild' : 'after',
        };
        _setSelected(arg);
      }
    },
    [insertAt],
  );

  const rootRef = useRef<HTMLUListElement>(null);
  const dragAtElemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setSelected([]);
    };
    window.addEventListener('keyup', l);
    return () => window.removeEventListener('keyup', l);
  });

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
      let dragTargetIncluded = selected.includes(dragTargetId);
      if (!dragTargetIncluded) {
        dragTargetIncluded = engine.fHasAncestor(
          dragTargetId,
          new Set(selected),
        );
      }
      if (!dragTargetIncluded) {
        if (evt.shiftKey) {
          setSelected([...selected, dragTargetId]);
        } else {
          setSelected([dragTargetId]);
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
    [engine, selected, setSelected],
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

      let targetPlace: FInsertPlace['at'];
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

      engine.fMove(selected, target);
      setSelected([]);

      dragTargetRef.current = null;
      rootRef.current?.classList.remove('dragging');
      evt.preventDefault();
    },
    [engine, selected, setSelected],
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
        <Entry
          key={child}
          fid={child}
          engine={engine}
          selected={selected}
          setSelected={setSelected}
        />
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
  targetPlace: FInsertPlace['at'],
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
  fid,
  engine,
  selected,
  setSelected,
}: {
  fid: number;
  engine: SyncEngine;
  selected: number[];
  setSelected: Dispatch<SetStateAction<number[]>>;
}) {
  const isSelected = useMemo(() => selected.includes(fid), [fid, selected]);

  const [children, setChildren] = useState(() => engine.fChildOrder(fid));
  useEffect(() => {
    engine.addFChildOrderListener(fid, setChildren);
    return () => engine.removeFChildOrderListener(fid, setChildren);
  }, [fid, engine]);

  return (
    <li
      draggable="true"
      data-fid={fid}
      onClick={(evt) => {
        if (evt.shiftKey) {
          if (isSelected) {
            setSelected(selected.filter((id) => id !== fid));
          } else {
            setSelected(selected.concat(fid));
          }
        } else {
          if (isSelected) {
            setSelected([]);
          } else {
            setSelected([fid]);
          }
        }
        evt.stopPropagation();
      }}
      className={cls(isSelected && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div className={cls(isSelected && 'bg-blue-100')}>
        <div
          className={cls(
            'flex flex-row justify-start w-full gap-1 px-1 text-sm',
          )}
          style={{
            paddingTop: `${VERTICAL_GAP_PX}px`,
            borderLeft: `${INDICATOR_BORDER_PX}px`,
          }}
        >
          <span className="flex-grow select-none text-start">{fid}</span>
        </div>

        {children.length > 0 && (
          <ul style={{ paddingLeft: `${CHILD_INDENT_PX}px` }}>
            {children.map((child) => (
              <Entry
                key={child}
                fid={child}
                engine={engine}
                selected={selected}
                setSelected={setSelected}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
