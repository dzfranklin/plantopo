import { useEffect, useRef } from "react";

import { PlanInteractionHandler } from "./PlanInteractionHandler";
import { PlanRenderer } from "./PlanRenderer";
import { type PlanState } from "./types";
import { useMapManager } from "@/components/map/MapManagerContext";
import { useIsMobile } from "@/hooks/useMediaQuery";

export function PlanMapOverlay() {
  const rendererRef = useRef<PlanRenderer | null>(null);
  const stateRef = useRef<PlanState>({ points: [] });
  const isMobile = useIsMobile();
  const mm = useMapManager();

  useEffect(() => {
    const m = mm.map;
    const im = mm.interactionManager;

    const renderer = new PlanRenderer({
      container: m.getCanvasContainer(),
      mlCanvas: m.getCanvas(),
      projector: m,
      isMobile,
    });
    rendererRef.current = renderer;

    const repaintNow = () => renderer.render(stateRef.current);
    let pendingRepaint: number | null = null;
    const requestRepaint = () => {
      if (pendingRepaint === null) {
        pendingRepaint = requestAnimationFrame(() => {
          pendingRepaint = null;
          repaintNow();
        });
      }
    };

    requestRepaint();
    m.on("render", repaintNow);

    const handler = new PlanInteractionHandler(
      m,
      () => rendererRef.current,
      () => stateRef.current,
      updater => {
        const next = updater(stateRef.current);
        stateRef.current = next;
        requestRepaint();
        return next;
      },
    );
    handler.enable();
    const removeHandler = im.addFirst("planEdit", handler, [
      "mouseRotate",
      "mousePitch",
    ]);

    return () => {
      removeHandler();
      m.off("render", repaintNow);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [isMobile, mm]);

  return null;
}
