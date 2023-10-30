import { createContext, useContext } from 'react';

const MapIdContext = createContext<string | null>(null);

export function useMapId() {
  const mapId = useContext(MapIdContext);
  if (!mapId) throw new Error('Expected map id provider');
  return mapId;
}

export function MapIdProvider({
  mapId,
  children,
}: {
  mapId: string;
  children: React.ReactNode;
}) {
  return (
    <MapIdContext.Provider value={mapId}>{children}</MapIdContext.Provider>
  );
}
