import cls from '@/app/cls';
import { SyncSocket } from '@/sync/SyncSocket';
import {
  Dispatch,
  DragEventHandler,
  SetStateAction,
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
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
  const [children, setChildren] = useState(() => driver.fChildren(0));
  useEffect(() => {
    driver.addFChildrenListener(0, setChildren);
    return () => driver.removeFChildrenListener(0, setChildren);
  }, [driver]);

  const [selected, setSelected] = useState<number[]>([]);
  const dragTargetRef = useRef<DragTarget | null>(null);

  const rootElemRef = useRef<HTMLDivElement>(null);
  const dragAtElemRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      const rootElem = rootElemRef.current;
      if (!rootElem) return;

      if (!(evt.target instanceof HTMLElement)) return;
      if (evt.target.dataset.fid === undefined) return;
      const dragTargetId = parseInt(evt.target.dataset.fid, 10);

      // Add the dragged element to targets if necessary
      let dragTargetIncluded = selected.includes(dragTargetId);
      if (!dragTargetIncluded) {
        dragTargetIncluded = driver.fHasAncestor(
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

      rootElem.classList.add('dragging');

      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('x-pt', 'selected');
      // Hide ghost as won't reflect what is actually being dragged
      evt.dataTransfer.setDragImage(new Image(), 0, 0);
    },
    [driver, selected],
  );

  const onDragEnter = useCallback<DragEventHandler<HTMLUListElement>>((evt) => {
    if (evt.dataTransfer.getData('x-pt') === '') {
      return;
    }
    evt.preventDefault();
  }, []);

  const onDragOver = useCallback<DragEventHandler<HTMLUListElement>>((evt) => {
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
    while (targetElem.dataset.fid === undefined) {
      targetElem = targetElem.parentElement;
      if (!(targetElem instanceof HTMLElement)) return;
    }

    const targetId = parseInt(targetElem.dataset.fid, 10);

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
  }, []);

  const onDrop = useCallback<DragEventHandler<HTMLUListElement>>(
    (evt) => {
      if (evt.dataTransfer.getData('x-pt') !== 'selected') {
        return;
      }

      const ordered = driver.orderFeatures(selected);
      console.info('drop', dragTargetRef.current, ordered);
      // TODO:

      dragTargetRef.current = null;

      evt.preventDefault();
    },
    [driver, selected],
  );

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
        {children.map((child) => (
          <Entry
            key={child}
            fid={child}
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
  fid,
  driver,
  selected,
  setSelected,
}: {
  fid: number;
  driver: SyncSocket;
  selected: number[];
  setSelected: Dispatch<SetStateAction<number[]>>;
}) {
  const isSelected = useMemo(() => selected.includes(fid), [fid, selected]);

  const [children, setChildren] = useState(() => driver.fChildren(fid));
  useEffect(() => {
    driver.addFChildrenListener(fid, setChildren);
    return () => driver.removeFChildrenListener(fid, setChildren);
  }, [fid, driver]);

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
      <div
        className={cls(
          isSelected ? 'bg-white border-blue-400' : 'border-transparent',
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
          <span className="flex-grow select-none text-start">{fid}</span>
        </div>

        {children.length > 0 && (
          <ul style={{ paddingLeft: `${CHILD_INDENT_PX}px` }}>
            {children.map((child) => (
              <Entry
                key={child}
                fid={child}
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
