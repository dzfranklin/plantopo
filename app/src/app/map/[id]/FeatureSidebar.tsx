import cls from '@/app/cls';
import { SyncSocket } from '@/sync/SyncSocket';
import {
  Dispatch,
  DragEventHandler,
  SetStateAction,
  UIEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import AddAtIcon from '@spectrum-icons/workflow/Add';
import './FeatureSidebar.css';

const CHILD_INDENT_PX = 16;
const VERTICAL_GAP_PX = 2;
const INDICATOR_BORDER_PX = 2;

type TargetPlace = 'before' | 'after' | 'firstChild';
interface DragTarget {
  id: number;
  elem: HTMLElement;
  place: TargetPlace;
}

export default function FeatureSidebar({ driver }: { driver: SyncSocket }) {
  // TODO:
  const [tree] = useState(() => ({
    id: 0,
    ancestors: [],
    linearIndex: 0,
    children: [
      {
        id: 1,
        linearIndex: 1,
        ancestors: [0],
        children: [],
      },
      {
        id: 2,
        linearIndex: 2,
        ancestors: [0],
        children: [],
      },
      {
        id: 3,
        ancestors: [0],
        linearIndex: 3,
        children: [
          {
            id: 4,
            ancestors: [3, 0],
            linearIndex: 4,
            children: [],
          },
          {
            id: 5,
            ancestors: [3, 0],
            linearIndex: 5,
            children: [],
          },
        ],
      },
      {
        id: 6,
        ancestors: [0],
        linearIndex: 6,
        children: [],
      },
      {
        id: 7,
        ancestors: [0],
        linearIndex: 7,
        children: [],
      },
      {
        id: 8,
        ancestors: [0],
        linearIndex: 8,
        children: [],
      },
      {
        id: 9,
        ancestors: [0],
        linearIndex: 9,
        children: [],
      },
      {
        id: 10,
        ancestors: [0],
        linearIndex: 10,
        children: [],
      },
      {
        id: 11,
        ancestors: [0],
        linearIndex: 11,
        children: [],
      },
      {
        id: 12,
        ancestors: [0],
        linearIndex: 12,
        children: [],
      },
      {
        id: 13,
        ancestors: [0],
        linearIndex: 13,
        children: [],
      },
    ],
  }));

  const [ancestorMap] = useState<Record<number, number[]>>(() => ({
    0: [],
    1: [0],
    2: [0],
    3: [0],
    4: [3, 0],
    5: [3, 0],
    6: [0],
    7: [0],
    8: [0],
    9: [0],
    10: [0],
    11: [0],
    12: [0],
    13: [0],
  }));

  const [linearIndexMap] = useState<Record<number, number>>(() => ({
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    11: 11,
    12: 12,
    13: 13,
  }));

  const [selected, setSelected] = useState<number[]>([]);
  const dragTargetRef = useRef<DragTarget | null>(null);

  const rootElemRef = useRef<HTMLDivElement>(null);
  const dragAtElemRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      const rootElem = rootElemRef.current;
      if (!rootElem) return;

      if (!(evt.target instanceof HTMLElement)) return;
      if (evt.target.dataset.entryId === undefined) return;
      const dragTargetId = parseInt(evt.target.dataset.entryId, 10);

      // Add the dragged element to targets if necessary
      let dragTargetIncluded = selected.includes(dragTargetId);
      if (!dragTargetIncluded) {
        for (const ancestor of ancestorMap[dragTargetId]) {
          if (selected.includes(ancestor)) {
            dragTargetIncluded = true;
            break;
          }
        }
      }
      if (!dragTargetIncluded) {
        if (evt.shiftKey) {
          setSelected([...selected, dragTargetId]);
        } else {
          setSelected([dragTargetId]);
        }
      }

      rootElem.classList.add('dragging');

      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('x-pt', 'selected');
      // Hide ghost as won't reflect what is actually being dragged
      evt.dataTransfer.setDragImage(new Image(), 0, 0);
    },
    [ancestorMap, selected],
  );

  const onDragEnter = useCallback<DragEventHandler<HTMLUListElement>>((evt) => {
    if (evt.dataTransfer.getData('x-pt') === '') {
      return;
    }
    evt.preventDefault();
  }, []);

  const onDragOver = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (evt.dataTransfer.getData('x-pt') === '') {
        return;
      }

      const rootElem = rootElemRef.current;
      const dragAtElem = dragAtElemRef.current;
      if (!rootElem || !dragAtElem) return;

      const rootRect = rootElem.getBoundingClientRect();

      let targetElem = document.elementFromPoint(
        rootRect.right - 20, // Subtract out potential scrollbar width
        evt.clientY,
      );
      if (!(targetElem instanceof HTMLElement)) return;
      while (targetElem.dataset.entryId === undefined) {
        targetElem = targetElem.parentElement;
        if (!(targetElem instanceof HTMLElement)) return;
      }

      const targetId = parseInt(targetElem.dataset.entryId, 10);

      const targetAncestors = ancestorMap[targetId];
      for (const selectedId of selected) {
        if (selectedId === targetId) {
          return;
        }
        for (const ancestor of targetAncestors) {
          if (selectedId === ancestor) {
            return;
          }
        }
      }

      let targetPlace: TargetPlace;
      const targetRect = targetElem.getBoundingClientRect();
      if (evt.clientY > targetRect.bottom - targetRect.height / 3) {
        targetPlace = 'after';
      } else if (evt.clientY < targetRect.top + targetRect.height / 3) {
        targetPlace = 'before';
      } else {
        targetPlace = 'firstChild';
      }

      dragTargetRef.current = {
        id: targetId,
        elem: targetElem,
        place: targetPlace,
      };

      positionDragAtMarker(dragAtElem, targetRect, targetPlace, true);

      evt.preventDefault();
    },
    [ancestorMap, selected],
  );

  const onDrop = useCallback<DragEventHandler<HTMLUListElement>>((evt) => {
    if (evt.dataTransfer.getData('x-pt') !== 'selected') {
      return;
    }

    console.info('drop', dragTargetRef.current);
    dragTargetRef.current = null;

    evt.preventDefault();
  }, []);

  const onDragEnd = useCallback<DragEventHandler<HTMLUListElement>>((_evt) => {
    rootElemRef.current?.classList.remove('dragging');
  }, []);

  const requestingDragMarkerReposition = useRef(false);
  const maybeDirtyDragMarker = useCallback(() => {
    if (dragTargetRef.current && !requestingDragMarkerReposition.current) {
      requestingDragMarkerReposition.current = true;

      requestAnimationFrame(() => {
        const target = dragTargetRef.current;
        if (!target || !dragAtElemRef.current) return;

        const targetRect = target.elem.getBoundingClientRect();
        positionDragAtMarker(
          dragAtElemRef.current,
          targetRect,
          target.place,
          false,
        );

        requestingDragMarkerReposition.current = false;
      });
    }
  }, []);

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (_evt) => maybeDirtyDragMarker(),
    [maybeDirtyDragMarker],
  );

  useEffect(() => {
    if (!rootElemRef.current) return;
    const observer = new ResizeObserver((_entries) => maybeDirtyDragMarker());
    observer.observe(rootElemRef.current);
    () => observer.disconnect();
  }, [maybeDirtyDragMarker]);

  return (
    <div
      className="w-[250px] h-full overflow-y-scroll bg-slate-100"
      onScroll={onScroll}
      ref={rootElemRef}
    >
      <div className="sticky top-0 z-10 bg-white">Toolbar</div>
      <ul
        onDragStart={onDragStart}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        className="pt-0.5 pb-10"
      >
        {tree.children.map((child) => (
          <Entry
            key={child.id}
            entry={child}
            driver={driver}
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
    </div>
  );
}

function positionDragAtMarker(
  dragAtElem: HTMLDivElement,
  targetRect: DOMRect,
  targetPlace: TargetPlace,
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
  entry,
  driver,
  selected,
  setSelected,
}: {
  entry: Entry;
  driver: SyncSocket;
  selected: number[];
  setSelected: Dispatch<SetStateAction<number[]>>;
}) {
  const ancestorSelected = ancestorIsSelected(selected, entry);
  const directlySelected = !ancestorSelected && selected.includes(entry.id);

  return (
    <li
      draggable="true"
      data-entry-id={entry.id}
      onClick={(evt) => {
        if (evt.shiftKey) {
          if (directlySelected) {
            setSelected(selected.filter((id) => id !== entry.id));
          } else if (!ancestorSelected) {
            setSelected(selected.concat(entry.id));
          }
        } else {
          if (directlySelected) {
            setSelected([]);
          } else {
            setSelected([entry.id]);
          }
        }
        evt.stopPropagation();
      }}
      className={cls(directlySelected && 'directly-selected')}
    >
      {/* We need this nested div so that we can find its parent by mouse
          position without the padding throwing us off */}
      <div
        className={cls(
          directlySelected ? 'bg-white border-blue-400' : 'border-transparent',
        )}
      >
        <div
          className={cls(
            'flex flex-row justify-start w-full gap-1 px-1 text-sm',
          )}
          style={{
            paddingTop: `${VERTICAL_GAP_PX}px`,
            borderLeft: `${INDICATOR_BORDER_PX}px`,
          }}
        >
          <span className="flex-grow select-none text-start">{entry.id}</span>
        </div>

        {entry.children.length > 0 && (
          <ul style={{ paddingLeft: `${CHILD_INDENT_PX}px` }}>
            {entry.children.map((child) => (
              <Entry
                key={child.id}
                entry={child}
                driver={driver}
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

function ancestorIsSelected(selected: number[], entry: Entry): boolean {
  for (const candidate of selected) {
    if (entry.ancestors.includes(candidate)) {
      return true;
    }
  }
  return false;
}

function cleanSelected(
  selected: number[],
  ancestorMap: Record<number, number[]>,
  linearIndexMap: Record<number, number>,
): number[] {
  const targetSet = new Set<number>();

  // Prune selected of redundant entries
  const orderedSelected = selected.slice();
  orderedSelected.sort((a, b) => ancestorMap[a].length - ancestorMap[b].length);
  for (const id of orderedSelected) {
    for (const ancestor of ancestorMap[id]) {
      if (targetSet.has(ancestor)) continue;
    }
    targetSet.add(id);
  }

  const targets = Array.from(targetSet);
  targets.sort((a, b) => linearIndexMap[a] - linearIndexMap[b]);

  return targets;
}
