import { RiCloseLine } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import ml from "maplibre-gl";

import "./ClickInfoPopup.css";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { MapManager } from "./MapManager";
import { useUserPrefs } from "@/auth/auth-client";
import { useTRPC } from "@/trpc";

interface Props {
  manager: MapManager | null;
}

export function ClickInfoPopup({ manager }: Props) {
  const trpc = useTRPC();
  const { distanceUnit } = useUserPrefs();

  const [lngLat, setLngLat] = useState<{ lng: number; lat: number } | null>(
    null,
  );

  useEffect(() => {
    if (!manager) return;
    const sub = manager.on("click", e => {
      setLngLat({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    return () => sub.unsubscribe();
  }, [manager]);

  const { mutate: mutateElevation, ...elevationMutation } = useMutation(
    trpc.map.elevation.mutationOptions(),
  );

  useEffect(() => {
    if (lngLat) {
      mutateElevation([[lngLat.lng, lngLat.lat]]);
    }
  }, [lngLat, mutateElevation]);

  const [container] = useState(() => document.createElement("div"));
  const [popup] = useState(
    () =>
      new ml.Popup({
        closeButton: false,
        maxWidth: "none",
        className: "click-info-popup",
      }),
  );

  useEffect(() => {
    const map = manager?.map;
    if (!map || !lngLat) return;

    popup.setLngLat([lngLat.lng, lngLat.lat]);
    popup.setDOMContent(container);
    popup.addTo(map);

    return () => {
      popup.remove();
    };
  }, [lngLat, manager, popup, container]);

  if (!lngLat) return null;

  const elevationM =
    elevationMutation.data != null ? elevationMutation.data.data[0] : undefined;
  const elevationDisplay = (() => {
    if (elevationMutation.isPending) return "Loading\u2026";
    if (elevationM == null) return "\u2014";
    if (distanceUnit === "mi") {
      return `${(elevationM * 3.28084).toFixed(1)} ft`;
    }
    return `${elevationM.toFixed(1)} m`;
  })();

  return createPortal(
    <div className="relative text-sm">
      <div className="flex flex-col gap-1 py-[15px] pr-8 pl-[10px]">
        <div className="font-mono text-xs text-gray-700">
          {lngLat.lat.toFixed(6)}, {lngLat.lng.toFixed(6)}
        </div>
        <div className="text-xs text-gray-500">
          Elevation: {elevationDisplay}
        </div>
      </div>
      <button
        onClick={() => setLngLat(null)}
        className="absolute top-0.5 right-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Close">
        <RiCloseLine size={16} />
      </button>
    </div>,
    container,
  );
}
