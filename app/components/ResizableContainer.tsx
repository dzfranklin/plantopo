import { ReactNode, useEffect, useRef } from 'react';

export function ResizableContainer(props: {
  children?: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}) {
  const propsRef = useRef(props);
  propsRef.current = props;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const initialProps = propsRef.current;
    const minWidth = initialProps.minWidth ?? 10;
    const minHeight = initialProps.minHeight ?? 10;
    const initialWidth =
      initialProps.initialWidth ?? initialProps.minWidth ?? 100;
    const initialHeight =
      initialProps.initialHeight ?? initialProps.minHeight ?? 100;

    el.style.width = initialWidth + 'px';
    el.style.height = initialHeight + 'px';

    const withinTarget = (e: MouseEvent, rect: DOMRect) =>
      Math.abs(e.clientX - rect.right) < 10 &&
      Math.abs(e.clientY - rect.bottom) < 10;

    let inDrag = false;

    let lastCursorFrame: number | undefined;
    el.addEventListener('mousemove', (e) => {
      if (inDrag) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const isWithin = withinTarget(e, rect);
      lastCursorFrame && cancelAnimationFrame(lastCursorFrame);
      lastCursorFrame = requestAnimationFrame(() => {
        el.style.cursor = isWithin ? 'se-resize' : '';
      });
    });

    const fixPosition = (rect: DOMRect, e: MouseEvent) => {
      const width = Math.max(minWidth, e.clientX - rect.left);
      const height = Math.max(minHeight, e.clientY - rect.top);
      el.style.width = width + 'px';
      el.style.height = height + 'px';
    };

    el.addEventListener('mousedown', (e) => {
      const rect = el.getBoundingClientRect();
      if (!withinTarget(e, rect)) {
        return;
      }
      e.preventDefault();
      inDrag = true;
      el.style.cursor = 'se-resize';
      el.style.position = 'fixed';
      el.style.top = rect.top + 'px';
      el.style.left = rect.left + 'px';
    });

    const endDrag = (rect: DOMRect) => {
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';

      el.style.cursor = el.style.position = el.style.top = el.style.left = '';

      inDrag = false;
    };

    window.addEventListener('mouseleave', () => {
      if (inDrag) {
        endDrag(el.getBoundingClientRect());
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (inDrag) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        fixPosition(rect, e);
        endDrag(rect);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!inDrag) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      fixPosition(rect, e);
    });
  }, []);

  return (
    <div ref={ref} className={props.className}>
      {props.children}
    </div>
  );
}
