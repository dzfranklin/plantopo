'use client';

import { createContext, useContext } from 'react';
import { GeoipData } from './schema';

const GeoipContext = createContext<GeoipData | null>(null);

export function GeoipProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: GeoipData | null;
}) {
  return (
    <GeoipContext.Provider value={value}>{children}</GeoipContext.Provider>
  );
}

export function useGeoip(): GeoipData | null {
  return useContext(GeoipContext);
}
