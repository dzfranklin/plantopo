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
  RiLockFill,
  RiLockLine,
  RiSubtractLine,
} from "@remixicon/react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  GeolocateState,
  GeolocateWatchState,
} from "./GeolocateStateMachine";
import { GeolocateStateMachine } from "./GeolocateStateMachine";
import { useMapManager } from "./MapManagerContext";
import { NorthArrowIcon } from "./NorthArrowIcon";
import { cn } from "@/util/cn";

interface NavControlsProps {
  terrain: boolean;
  onTerrainChange?: (enabled: boolean) => void;
}

export function NavControls({ terrain, onTerrainChange }: NavControlsProps) {
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

  const manager = useMapManager();
  const map = manager?.map;

  const [expanded, setExpanded] = useState<"false" | "by-hover" | "by-press">(
    "false",
  );
  const expandedRef = useRef(expanded);
  useLayoutEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const bearingButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = bearingButtonRef.current;
    if (!el) return;

    const onContextMenu = (e: Event) => {
      e.preventDefault();
      if (expandedRef.current === "false") {
        setExpanded("by-press");
      } else if (expandedRef.current === "by-press") {
        setExpanded("false");
      }
    };

    const onClick = () => {
      if (expandedRef.current === "by-press") {
        setExpanded("false");
      } else {
        map?.easeTo({ bearing: 0, pitch: 0 });
      }
    };

    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("click", onClick);
    };
  }, [map]);

  const bearing = useSyncExternalStore(
    useCallback(
      notify => {
        if (!map) return () => {};
        map.on("rotate", notify);
        return () => map.off("rotate", notify);
      },
      [map],
    ),
    () => map?.getBearing() ?? 0,
  );

  const pitch = useSyncExternalStore(
    useCallback(
      notify => {
        if (!map) return () => {};
        map.on("pitch", notify);
        return () => map.off("pitch", notify);
      },
      [map],
    ),
    () => map?.getPitch() ?? 0,
  );

  const pitchLocked = useSyncExternalStore(
    useCallback(
      notify => {
        if (!manager || !map) return () => {};
        map.on("plantopo:pitchlockchange", notify);
        return () => map.off("plantopo:pitchlockchange", notify);
      },
      [manager, map],
    ),
    () => manager?.getPitchLocked() ?? false,
  );

  return (
    <div
      className="relative flex items-center"
      onPointerEnter={e => e.pointerType === "mouse" && setExpanded("by-hover")}
      onPointerLeave={e => e.pointerType === "mouse" && setExpanded("false")}>
      {/* Slide-out rotation buttons */}
      <div
        className={cn(
          "absolute right-full flex flex-row items-center gap-0 pr-1.5 transition-all duration-200",
          expanded === "false"
            ? "pointer-events-none translate-x-2 opacity-0"
            : "translate-x-0 opacity-100",
        )}>
        <div
          className="flex flex-row items-center gap-1.5"
          style={{ boxShadow: "none" }}>
          <HorizontalControlGroup>
            <ControlButton
              title={pitchLocked ? "Unlock pitch" : "Lock pitch"}
              active={pitchLocked}
              onClick={() => manager?.setPitchLocked(!pitchLocked)}
              horizontal>
              {pitchLocked ? (
                <RiLockFill size={16} />
              ) : (
                <RiLockLine size={16} />
              )}
            </ControlButton>
            <ControlButton
              title={`Pitch down ${pitchIncrement}°`}
              disabled={pitchLocked || pitch <= 0}
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
              disabled={pitchLocked || pitch >= maxPitch}
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
          ref={bearingButtonRef}
          title={expanded === "by-press" ? "Close" : "Reset north"}>
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

const ControlButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
    horizontal?: boolean;
  }
>(function ControlButton(
  { active, horizontal, children, ...forwardedProps },
  ref,
) {
  return (
    <button
      {...forwardedProps}
      ref={ref}
      className={cn(
        "flex size-[40px] items-center justify-center sm:size-[29px]",
        "bg-transparent hover:bg-black/5 disabled:cursor-not-allowed",
        "disabled:[&_.icon]:opacity-25 [&:not(:disabled)_.icon]:opacity-100",
        horizontal
          ? "border-l border-[#ddd] first:border-l-0"
          : "border-t border-[#ddd] first:border-t-0",
        active && "text-blue-600",
      )}>
      <span className="icon [&_svg]:size-5 sm:[&_svg]:size-4">{children}</span>
    </button>
  );
});

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
