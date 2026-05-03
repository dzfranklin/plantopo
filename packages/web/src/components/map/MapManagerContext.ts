import { createContext, useContext } from "react";

import type { MapManager, ReadyMapManager } from "./MapManager";

export const MapManagerContext = createContext<MapManager | null>(null);

export function useMapManager(): ReadyMapManager {
  const ctx = useContext(MapManagerContext);
  if (!ctx) throw new Error("useMapManager must be used inside MapView");
  return ctx as ReadyMapManager;
}
