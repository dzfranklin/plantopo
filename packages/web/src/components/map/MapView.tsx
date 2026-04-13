import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useRef, useState } from "react";

import { MapManager } from "./MapManager";
import type { MapProps } from "./types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MapView(props: MapProps) {
  const managerRef = useRef<MapManager | null>(null);

  const initialPropsRef = useRef(props);
  // eslint-disable-next-line react-hooks/refs
  initialPropsRef.current = props;

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
      initialPropsRef.current.onManager?.(manager);
    } else {
      managerRef.current?.destroy();
      managerRef.current = null;
    }
  }, []);

  // eslint-disable-next-line react-hooks/refs
  managerRef.current?.setProps(props);

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
          {(import.meta.env.DEV || props.debug) && (
            <DebugPanel managerRef={managerRef} />
          )}
        </DialogContent>
      </Dialog>
    </div>
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
