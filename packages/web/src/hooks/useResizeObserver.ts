import { useLayoutEffect, useState } from "react";

export default function useResizeObserver(
  ref: React.RefObject<Element | null>,
  options?: ResizeObserverOptions,
): ResizeObserverEntry | null {
  const { box, ...rest } = options ?? {};
  const _exhaustive: Record<string, never> = rest;

  const [entry, setEntry] = useState<ResizeObserverEntry | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(entries => {
      if (entries.length > 0) setEntry(entries[0]!);
    });

    observer.observe(ref.current, { box });

    return () => {
      observer.disconnect();
    };
  }, [ref, box]);

  return entry;
}
