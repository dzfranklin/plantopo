import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react';

const ctx = createContext<null | [boolean, Dispatch<SetStateAction<boolean>>]>(
  null,
);

export function DebugModeProvider({ children }: { children: React.ReactNode }) {
  const state = useState(false);
  return <ctx.Provider value={state}>{children}</ctx.Provider>;
}

export function useDebugMode(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const state = useContext(ctx);
  if (!state) throw new Error('useDebugMode: no provider');
  return state;
}
