import { createContext, useContext, useEffect, useRef } from 'react';
import type { Map as MLMap, MapEventType } from 'maplibre-gl';
import { MapManager } from '@/features/map/MapManager';

export const MapContext = createContext<MapManager | null>(null);

export function useMapManager(): MapManager {
  const value = useContext(MapContext);
  if (!value) throw new Error('not a child of MapComponent');
  return value;
}

/** Returns the active map once the map style is loaded */
export function useMap(): MLMap {
  return useMapManager().m;
}

export function useOnMap<
  T extends keyof MapEventType,
  Event extends MapEventType[T],
>(event: T, cb: (ev: Event, map: MLMap) => void) {
  const m = useMap();
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    function wrapper(ev: Event) {
      cbRef.current(ev, m);
    }

    m.on(event, wrapper);
    return () => {
      m.off(event, wrapper);
    };
  }, [m, event]);
}
