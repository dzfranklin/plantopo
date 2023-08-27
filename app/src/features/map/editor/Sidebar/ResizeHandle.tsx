import { useCallback, useRef, PointerEvent } from 'react';

const WIDTH_MIN = 60;

const END_EVENTS: Array<'pointerup' | 'pointercancel' | 'pointerleave'> = [
  'pointerup',
  'pointercancel',
  'pointerleave',
];

export function ResizeHandle({ setWidth }: { setWidth: (_: number) => void }) {
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
      window.removeEventListener('pointermove', onPointerMove, {
        capture: true,
      });
      for (const evt of END_EVENTS) {
        window.removeEventListener(evt as any, onEnd, { capture: true });
      }
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
      for (const evt of END_EVENTS) {
        addEventListener(evt, onEnd, { capture: true });
      }
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
      className="shrink-0 border-l w-[5px] border-transparent hover:bg-blue-400 cursor-ew-resize"
      onPointerDownCapture={(evt) => startDrag(evt)}
    />
  );
}
