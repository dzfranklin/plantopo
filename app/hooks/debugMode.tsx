'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const ctx = createContext(false);

export function DebugModeProvider(props: {
  children: React.ReactNode;
  forceAllowed?: boolean;
}) {
  const [allowedState, setAllowed] = useState(false);
  const allowed = props.forceAllowed || allowedState;

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('allowDebugMode')) {
      setAllowed(true);

      if (localStorage.getItem('debugMode')) {
        setEnabled(true);
      }
    }
  }, []);

  const toggleDebugMode = useCallback(
    () =>
      setEnabled((p) => {
        if (p) {
          localStorage.removeItem('debugMode');
          return false;
        } else {
          localStorage.setItem('debugMode', 'true');
          return true;
        }
      }),
    [],
  );

  return (
    <ctx.Provider value={enabled}>
      {props.children}

      {allowed && (
        <div className="fixed left-0.5 top-0.5 z-50 w-7 h-4">
          <button className="p-1 text-xs" onClick={() => toggleDebugMode()}>
            {enabled ? '!dbg' : 'dbg'}
          </button>
        </div>
      )}
    </ctx.Provider>
  );
}

export function allowDebugMode() {
  localStorage.setItem('allowDebugMode', 'true');
}

export function forbidDebugMode() {
  localStorage.removeItem('allowDebugMode');
}

export function useIsDebugModeAllowed(): boolean {
  const [isAllowed, setIsAllowed] = useState(false);
  useEffect(() => {
    setIsAllowed(!!localStorage.getItem('allowDebugMode'));
  }, []);
  return isAllowed;
}

export function useDebugMode(): boolean {
  return useContext(ctx);
}
