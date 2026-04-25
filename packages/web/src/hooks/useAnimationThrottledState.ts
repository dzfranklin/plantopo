import { useCallback, useRef, useState } from "react";

const UNSET = Symbol("unset");

export default function useAnimationThrottledState<T>(
  initialState: T | (() => T),
): [T, (newState: T) => void] {
  const [state, setState] = useState(initialState);
  const pendingState = useRef<T | typeof UNSET>(UNSET);
  const pendingAnimationFrame = useRef<number | null>(null);

  const setAnimationFrameState = useCallback((newState: T): void => {
    pendingState.current = newState;
    if (pendingAnimationFrame.current === null) {
      pendingAnimationFrame.current = requestAnimationFrame(() => {
        if (pendingState.current !== UNSET) {
          setState(pendingState.current);
          pendingState.current = UNSET;
        }
        pendingAnimationFrame.current = null;
      });
    }
  }, []);

  return [state, setAnimationFrameState];
}
