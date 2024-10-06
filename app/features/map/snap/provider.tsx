import { createContext, ReactNode, useContext, useMemo } from 'react';
import { HighwayGraph } from '@/features/map/snap/HighwayGraph';
import { unreachable } from '@/errors';

const HighwayGraphContext = createContext<HighwayGraph | null>(null);

export function HighwayGraphProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => new HighwayGraph(), []);
  return (
    <HighwayGraphContext.Provider value={value}>
      {children}
    </HighwayGraphContext.Provider>
  );
}

export function useHighwayGraph(): HighwayGraph {
  const value = useContext(HighwayGraphContext);
  if (!value) unreachable('expected HighwayGraphProvider');
  return value;
}
