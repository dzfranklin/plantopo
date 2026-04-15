import { createContext, useContext } from "react";

import type { MapManager } from "./MapManager";

export const MapManagerContext = createContext<MapManager | null>(null);

export function useMapManager(): MapManager | null {
  return useContext(MapManagerContext);
}
