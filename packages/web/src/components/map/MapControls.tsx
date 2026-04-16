import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowTurnBackFill,
  RiArrowTurnForwardFill,
  RiArrowUpSLine,
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
import { useMapManager } from "./MapManagerContext";
import { NorthArrowIcon } from "./NorthArrowIcon";
import { cn } from "@/cn";

interface MapControlsProps {
  terrain: boolean;
  onTerrainChange?: (enabled: boolean) => void;
}

export function MapControls({ terrain, onTerrainChange }: MapControlsProps) {
  const map = useMapManager()?.map;

  const [geolocate, setGeolocate] = useState<GeolocateState>({
    watchState: "OFF",
    supported: false,
  });

  const geolocateMachineRef = useRef<GeolocateStateMachine | null>(null);

  useEffect(() => {
    if (!map) return;
    const machine = new GeolocateStateMachine(map, setGeolocate);
    geolocateMachineRef.current = machine;
    return () => {
      machine.destroy();
      geolocateMachineRef.current = null;
    };
  }, [map]);

  const showTerrain = onTerrainChange !== undefined;

  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-2.5">
      <ControlGroup>
        <ControlButton title="Zoom in" onClick={() => map?.zoomIn()}>
          <RiAddLine size={16} />
        </ControlButton>
        <ControlButton title="Zoom out" onClick={() => map?.zoomOut()}>
          <RiSubtractLine size={16} />
        </ControlButton>
      </ControlGroup>

      <BearingControlGroup />

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

function BearingControlGroup() {
  const maxPitch = 60;
  const bearingIncrement = 90;
  const pitchIncrement = maxPitch / 5;
  const incrementDuration = 150;

  const map = useMapManager()?.map;
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    const onPitch = () => setPitch(map.getPitch());
    map.on("rotate", onRotate);
    map.on("pitch", onPitch);
    return () => {
      map.off("rotate", onRotate);
      map.off("pitch", onPitch);
    };
  }, [map]);

  return (
    <div
      className="relative flex items-center"
      onPointerEnter={e => {
        if (e.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={e => {
        if (e.pointerType === "mouse") setHovered(false);
      }}>
      {/* Slide-out rotation buttons */}
      <div
        className={cn(
          "absolute right-full flex flex-row items-center gap-0 pr-1.5 transition-all duration-200",
          hovered
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-2 opacity-0",
        )}>
        <div
          className="flex flex-row items-center gap-1.5"
          style={{ boxShadow: "none" }}>
          <HorizontalControlGroup>
            <ControlButton
              title={`Pitch down ${pitchIncrement}°`}
              disabled={pitch <= 0}
              onClick={() => {
                const p = map?.getPitch() ?? 0;
                map?.easeTo({
                  pitch: Math.max(
                    0,
                    Math.ceil(p / pitchIncrement - 1) * pitchIncrement,
                  ),
                  duration: incrementDuration,
                });
              }}
              horizontal>
              <RiArrowDownSLine size={16} />
            </ControlButton>
            <ControlButton
              title={`Pitch up ${pitchIncrement}°`}
              disabled={pitch >= maxPitch}
              onClick={() => {
                const p = map?.getPitch() ?? 0;
                map?.easeTo({
                  pitch: Math.min(
                    maxPitch,
                    Math.floor(p / pitchIncrement + 1) * pitchIncrement,
                  ),
                  duration: incrementDuration,
                });
              }}
              horizontal>
              <RiArrowUpSLine size={16} />
            </ControlButton>
          </HorizontalControlGroup>
          <HorizontalControlGroup>
            <ControlButton
              title={`Rotate ${bearingIncrement}° clockwise`}
              onClick={() => {
                const b = map?.getBearing() ?? 0;
                map?.rotateTo(
                  Math.floor(b / bearingIncrement + 1) * bearingIncrement,
                  { duration: incrementDuration },
                );
              }}
              horizontal>
              <RiArrowTurnForwardFill size={16} />
            </ControlButton>
            <ControlButton
              title={`Rotate ${bearingIncrement}° counter-clockwise`}
              onClick={() => {
                const b = map?.getBearing() ?? 0;
                map?.rotateTo(
                  Math.ceil(b / bearingIncrement - 1) * bearingIncrement,
                  { duration: incrementDuration },
                );
              }}
              horizontal>
              <RiArrowTurnBackFill size={16} />
            </ControlButton>
          </HorizontalControlGroup>
        </div>
      </div>

      {/* Bearing button — drag up/down to pitch */}
      <ControlGroup>
        <ControlButton
          title="Reset north"
          onClick={() => map?.resetNorthPitch()}>
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

function HorizontalControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-row overflow-hidden rounded-[4px] bg-white"
      style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.1)" }}>
      {children}
    </div>
  );
}

function ControlButton({
  title,
  onClick,
  onMouseDown,
  disabled,
  active,
  horizontal,
  style,
  children,
}: {
  title: string;
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  horizontal?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      style={style}
      className={cn(
        "flex size-[29px] items-center justify-center",
        "bg-transparent hover:bg-black/5 disabled:cursor-not-allowed",
        "disabled:[&_.icon]:opacity-25 [&:not(:disabled)_.icon]:opacity-100",
        horizontal
          ? "border-l border-[#ddd] first:border-l-0"
          : "border-t border-[#ddd] first:border-t-0",
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
