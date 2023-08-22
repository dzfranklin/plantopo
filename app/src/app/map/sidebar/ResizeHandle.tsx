import {
  Dispatch,
  SetStateAction,
  useCallback,
  useRef,
  PointerEvent,
} from 'react';

const WIDTH_MIN = 60;

export function ResizeHandle({
  setWidth,
}: {
  setWidth: Dispatch<SetStateAction<number>>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragAnimPrev = useRef<number | null>(null);
  const dragAnimNext = useRef<number | null>(null);
  const animateStep = useCallback(() => {
    if (dragAnimNext.current === null) return;
    if (dragAnimPrev.current !== dragAnimNext.current) {
      setWidth(dragAnimNext.current);
      dragAnimPrev.current = dragAnimNext.current;
    }
    requestAnimationFrame(animateStep);
  }, [setWidth]);
  const onPointerMove = useCallback((evt: globalThis.PointerEvent) => {
    dragAnimNext.current = Math.max(WIDTH_MIN, evt.clientX);
    evt.preventDefault();
    evt.stopPropagation();
  }, []);
  const onEnd = useCallback(
    (evt: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('pointerleave', onEnd);
      dragAnimNext.current = null;
      ref.current?.classList.remove('bg-blue-400');
      evt.preventDefault();
      evt.stopPropagation();
    },
    [onPointerMove],
  );
  const startDrag = useCallback(
    (evt: PointerEvent<HTMLDivElement>) => {
      addEventListener('pointermove', onPointerMove, { capture: true });
      addEventListener('pointerup', onEnd, { capture: true });
      addEventListener('pointercancel', onEnd, { capture: true });
      addEventListener('pointerleave', onEnd, { capture: true });
      dragAnimNext.current = evt.clientX;
      ref.current?.classList.add('bg-blue-400');
      evt.preventDefault();
      evt.stopPropagation();
      requestAnimationFrame(animateStep);
    },
    [animateStep, onPointerMove, onEnd],
  );

  return (
    <div
      ref={ref}
      className="shrink-0 border-l w-[5px] border-slate-200 hover:bg-blue-400 cursor-ew-resize"
      onPointerDownCapture={(evt) => startDrag(evt)}
    />
  );
}
