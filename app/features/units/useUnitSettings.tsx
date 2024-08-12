'use client';

import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';
import { UnitSettings } from './schema';
import { setUnitSettings } from './clientApi';

export const UnitSettingsContext = createContext<
  [UnitSettings, Dispatch<SetStateAction<UnitSettings>>] | null
>(null);

export const defaultValue: UnitSettings = {
  distance: 'metric',
  elevation: 'metric',
};

export function useUnitSettings() {
  const context = useContext(UnitSettingsContext);
  if (!context) {
    throw new Error(
      'useUnitSettings must be used within a UnitSettingsProvider',
    );
  }
  return context;
}

export function UnitSettingsClientProvider(props: {
  initialValue: UnitSettings | null;
  children: React.ReactNode;
}) {
  const [state, _setState] = useState<UnitSettings>(
    props.initialValue ?? defaultValue,
  );

  const value: [UnitSettings, Dispatch<SetStateAction<UnitSettings>>] = useMemo(
    () => [
      state,
      (arg) => {
        let newState: UnitSettings;
        if (typeof arg === 'function') {
          newState = arg(state);
        } else {
          newState = arg;
        }

        _setState(newState);
        setUnitSettings(newState);
      },
    ],
    [state],
  );

  return (
    <UnitSettingsContext.Provider value={value}>
      {props.children}
    </UnitSettingsContext.Provider>
  );
}
