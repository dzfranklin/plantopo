import type ml from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";

import { MapManager } from "./MapManager";
import type { MapProps } from "./types";

interface ContextMenu {
  x: number;
  y: number;
  lngLat: ml.LngLat;
}

export function MapView(props: MapProps) {
  const managerRef = useRef<MapManager | null>(null);

  const initialPropsRef = useRef(props);
  // eslint-disable-next-line react-hooks/refs
  initialPropsRef.current = props;

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [attributionModalHTML, setAttributionModalHTML] = useState<
    string | null
  >(null);
  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (container) {
      const manager = new MapManager(container, {
        ...initialPropsRef.current,
        onShowAttributions: (html) => setAttributionModalHTML(html),
      });
      managerRef.current = manager;
      initialPropsRef.current.onManager?.(manager);
      manager.map?.on("contextmenu", (e) => {
        setContextMenu({ x: e.point.x, y: e.point.y, lngLat: e.lngLat });
      });
    } else {
      managerRef.current?.destroy();
      managerRef.current = null;
    }
  }, []);

  // eslint-disable-next-line react-hooks/refs
  managerRef.current?.setProps(props);

  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = () => setContextMenu(null);
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [contextMenu]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <Dialog
        open={attributionModalHTML !== null}
        onOpenChange={(open) => {
          if (!open) setAttributionModalHTML(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribution</DialogTitle>
          </DialogHeader>
          <DialogDescription
            dangerouslySetInnerHTML={{ __html: attributionModalHTML ?? "" }}
          />
        </DialogContent>
      </Dialog>
      {contextMenu && (
        <div
          style={{
            position: "absolute",
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          className="z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {import.meta.env.DEV && (
            <button
              className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                const w = window as unknown as Record<string, unknown>;
                const varName = !w._map
                  ? "_map"
                  : `_map${Object.keys(w).filter((k) => /^_map\d*$/.test(k)).length}`;
                w[varName] = managerRef.current;
                console.log(`Stored map as window.${varName}`);
                setContextMenu(null);
              }}
            >
              Store as global variable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
