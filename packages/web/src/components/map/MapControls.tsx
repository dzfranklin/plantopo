import {
  RiAddLine,
  RiFocus3Line,
  RiGpsFill,
  RiLandscapeFill,
  RiLandscapeLine,
  RiSubtractLine,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";

import type {
  GeolocateState,
  GeolocateWatchState,
} from "./GeolocateStateMachine";
import { GeolocateStateMachine } from "./GeolocateStateMachine";
import type { MapManager } from "./MapManager";
import { NorthArrowIcon } from "./NorthArrowIcon";
import { cn } from "@/cn";

interface MapControlsProps {
  manager: MapManager;
  terrain: boolean;
  onTerrainChange?: (enabled: boolean) => void;
}

export function MapControls({
  manager,
  terrain,
  onTerrainChange,
}: MapControlsProps) {
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [geolocate, setGeolocate] = useState<GeolocateState>({
    watchState: "OFF",
    supported: false,
  });

  const geolocateMachineRef = useRef<GeolocateStateMachine | null>(null);

  useEffect(() => {
    const m = manager.map;
    if (!m) return;

    const onRotate = () => setBearing(m.getBearing());
    const onPitch = () => setPitch(m.getPitch());
    m.on("rotate", onRotate);
    m.on("pitch", onPitch);

    const machine = new GeolocateStateMachine(m, setGeolocate);
    geolocateMachineRef.current = machine;

    return () => {
      m.off("rotate", onRotate);
      m.off("pitch", onPitch);
      machine.destroy();
      geolocateMachineRef.current = null;
    };
  }, [manager]);

  const showTerrain = onTerrainChange !== undefined;

  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-2.5">
      <ControlGroup>
        <ControlButton title="Zoom in" onClick={() => manager.map?.zoomIn()}>
          <RiAddLine size={16} />
        </ControlButton>
        <ControlButton title="Zoom out" onClick={() => manager.map?.zoomOut()}>
          <RiSubtractLine size={16} />
        </ControlButton>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          title="Reset north"
          onClick={() => manager.map?.resetNorthPitch()}>
          <span style={{ transformStyle: "preserve-3d" }}>
            <NorthArrowIcon
              size={16}
              style={{
                transform: `scale(${1 / Math.pow(Math.cos((pitch * Math.PI) / 180), 0.5)}) rotateX(${pitch}deg) rotateZ(${-bearing}deg)`,
              }}
            />
          </span>
        </ControlButton>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          title={geolocateTitle(geolocate.watchState)}
          disabled={!geolocate.supported}
          active={
            geolocate.watchState === "ACTIVE_LOCK" ||
            geolocate.watchState === "WAITING_ACTIVE"
          }
          onClick={() => geolocateMachineRef.current?.trigger()}>
          {geolocate.watchState === "ACTIVE_LOCK" ||
          geolocate.watchState === "BACKGROUND" ? (
            <RiGpsFill size={16} />
          ) : (
            <RiFocus3Line size={16} />
          )}
        </ControlButton>
      </ControlGroup>

      {showTerrain && (
        <ControlGroup>
          <ControlButton
            title={terrain ? "Disable 3D terrain" : "Enable 3D terrain"}
            active={terrain}
            onClick={() => onTerrainChange!(!terrain)}>
            {terrain ? (
              <RiLandscapeFill size={16} />
            ) : (
              <RiLandscapeLine size={16} />
            )}
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  );
}

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[4px] bg-white"
      style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.1)" }}>
      {children}
    </div>
  );
}

function ControlButton({
  title,
  onClick,
  disabled,
  active,
  style,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cn(
        "flex size-[29px] items-center justify-center",
        "bg-transparent hover:bg-black/5 disabled:cursor-not-allowed",
        "disabled:[&_.icon]:opacity-25 [&:not(:disabled)_.icon]:opacity-100",
        "border-t border-[#ddd] first:border-t-0",
        active && "text-blue-600",
      )}>
      <span className="icon">{children}</span>
    </button>
  );
}

function geolocateTitle(watchState: GeolocateWatchState): string {
  switch (watchState) {
    case "OFF":
      return "Find my location";
    case "WAITING_ACTIVE":
      return "Locating…";
    case "ACTIVE_LOCK":
      return "Tracking location";
    case "BACKGROUND":
      return "Location active (tap to re-centre)";
    case "ACTIVE_ERROR":
    case "BACKGROUND_ERROR":
      return "Location error";
    default:
      return "Find my location";
  }
}
