import { useEffect } from "react";

import { useMapManager } from "@/components/map/MapManagerContext";

export function PlanMapOverlay() {
  const mm = useMapManager();
  useEffect(() => {
    const m = mm?.map;
    if (!m) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";
    m.getCanvasContainer().append(canvas);

    return () => {
      canvas.remove();
    };
  }, [mm]);
  return null;
}
