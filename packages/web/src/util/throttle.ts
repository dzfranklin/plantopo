// From maplibre-gl-js

/**
 * Throttle the given function to run at most every `period` milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  time: number,
): (...args: Parameters<T>) => ReturnType<typeof setTimeout> | null {
  let pending = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastCallArgs: Parameters<T>;

  const later = () => {
    timerId = null;
    if (pending) {
      fn(...lastCallArgs);
      timerId = setTimeout(later, time);
      pending = false;
    }
  };

  return (...args: Parameters<T>) => {
    pending = true;
    lastCallArgs = args;
    if (!timerId) {
      later();
    }
    return timerId;
  };
}
