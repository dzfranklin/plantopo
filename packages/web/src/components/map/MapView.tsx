import type ml from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { MapManager } from "./MapManager";
import type { MapProps } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      const manager = new MapManager(
        {
          container,
          onDisplayFullAttribution: html => setAttributionModalHTML(html),
        },
        initialPropsRef.current,
      );
      managerRef.current = manager;
      manager.map?.on("contextmenu", e => {
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
        onOpenChange={open => {
          if (!open) setAttributionModalHTML(null);
        }}>
        <DialogContent className="sm:max-w-2xl">
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
          className="bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md"
          onPointerDown={e => e.stopPropagation()}>
          {import.meta.env.DEV && (
            <button
              className="hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
              onClick={() => {
                const w = window as unknown as Record<string, unknown>;
                const varName = !w._map
                  ? "_map"
                  : `_map${Object.keys(w).filter(k => /^_map\d*$/.test(k)).length}`;
                w[varName] = managerRef.current;
                console.log(`Stored map as window.${varName}`);
                setContextMenu(null);
              }}>
              Store as global variable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
