import { createContext, useContext, useMemo } from 'react';
import { GeoipData, geoipSchema } from './schema';
import cookie from 'cookie';

const GeoipContext = createContext<GeoipData | null>(null);

export function GeoipProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    const cookies = cookie.parse(document.cookie);
    if (!('geoip' in cookies)) {
      return null;
    }
    const parsed = geoipSchema.safeParse(cookies.geoip);
    if (!parsed.data) {
      return null;
    }
    return parsed.data;
  }, []);

  return (
    <GeoipContext.Provider value={value}>{children}</GeoipContext.Provider>
  );
}

export function MockGeoipProvider({
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
