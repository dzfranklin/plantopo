import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useRef, useState } from "react";

import { MapManager } from "./MapManager";
import { MapManagerContext } from "./MapManagerContext";
import { NavControls } from "./NavControls";
import { getHashParam, setHashParam } from "./hashParams";
import type { MapProps } from "./types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebugFlag } from "@/hooks/debug-flags";

export function MapView(props: MapProps) {
  const { children, ...forwardedProps } = props;
  const mayShowDebug = useDebugFlag("showDebugOptions");
  const managerRef = useRef<MapManager | null>(null);
  const [manager, setManager] = useState<MapManager | null>(null);
  const hashTerrain = props.hash && props.terrain === undefined;
  const [uncontrolledTerrain, setUncontrolledTerrain] = useState(() =>
    hashTerrain ? getHashParam("t") === "1" : false,
  );

  const terrain = props.terrain ?? uncontrolledTerrain;

  // Write initial terrain into the hash on mount
  useEffect(() => {
    if (!hashTerrain) return;
    if (getHashParam("t") === null && uncontrolledTerrain) {
      setHashParam("t", "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep uncontrolledTerrain in sync if the hash is changed externally
  useEffect(() => {
    if (!hashTerrain) return;
    const handler = () => {
      setUncontrolledTerrain(getHashParam("t") === "1");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [hashTerrain]);

  const [attributionModalHTML, setAttributionModalHTML] = useState<
    string | null
  >(null);
  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (container) {
      const m = new MapManager(
        {
          container,
          onDisplayFullAttribution: html => setAttributionModalHTML(html),
        },
        forwardedProps,
      );
      managerRef.current = m;
      setManager(m);
      forwardedProps.onManager?.(m);
    } else {
      managerRef.current?.destroy();
      managerRef.current = null;
      setManager(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  managerRef.current?.setProps({ ...forwardedProps, terrain });

  const interactive = props.interactive ?? true;

  return (
    <MapManagerContext.Provider value={manager}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {interactive && manager && (
          <NavControls
            terrain={terrain}
            onTerrainChange={
              props.terrain === undefined
                ? v => {
                    setUncontrolledTerrain(v);
                    if (hashTerrain) setHashParam("t", v ? "1" : null);
                  }
                : undefined
            }
          />
        )}
        {children}
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
            {mayShowDebug && <DebugPanel managerRef={managerRef} />}
          </DialogContent>
        </Dialog>
      </div>
    </MapManagerContext.Provider>
  );
}

function DebugPanel({
  managerRef,
}: {
  managerRef: React.RefObject<MapManager | null>;
}) {
  return (
    <div className="border-t pt-4">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Debug
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const w = window as unknown as Record<string, unknown>;
          const varName = !w._map
            ? "_map"
            : `_map${Object.keys(w).filter(k => /^_map\d*$/.test(k)).length}`;
          w[varName] = managerRef.current;
          w["MapManager"] = MapManager;
          console.log(varName);
          console.log(w[varName]);
        }}>
        Store map as global variable
      </Button>
    </div>
  );
}
