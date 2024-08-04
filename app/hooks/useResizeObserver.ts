import { useEffect } from 'react';

export default function useResizeObserver<T extends HTMLElement>(
  ref: React.RefObject<T>,
  callback: ResizeObserverCallback,
) {
  useEffect(() => {
    const observer = new ResizeObserver(callback);
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => {
      observer.disconnect();
    };
  }, [ref, callback]);
}
