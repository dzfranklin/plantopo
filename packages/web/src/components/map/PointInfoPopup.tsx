import { RiCloseLine, RiLink } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import OSGridRef, * as osgridref from "geodesy/osgridref.js";
import ml from "maplibre-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import "./PointInfoPopup.css";

import { METERS_TO_FT } from "@pt/shared";

import type { MapManager } from "./MapManager";
import { useUserPrefs } from "@/auth/auth-client";
import { cn } from "@/cn";
import { useTRPC } from "@/trpc";

function ExternalMapLink({
  href,
  title,
  src,
  className,
}: {
  href: string;
  title: string;
  src: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="rounded p-0.5 hover:bg-gray-100">
      <img
        src={src}
        alt=""
        className={cn("h-6 w-6 sm:h-4 sm:w-4", className)}
      />
    </a>
  );
}

function CopyableValue({
  text,
  successMsg,
}: {
  text: string;
  successMsg: string;
}) {
  return (
    <button
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => toast.success(successMsg))
      }
      className="text-left font-medium tracking-wider text-gray-700 hover:text-blue-800"
      title="Click to copy">
      {text}
    </button>
  );
}

interface Props {
  manager: MapManager | null;
}

export function PointInfoPopup({ manager }: Props) {
  const trpc = useTRPC();
  const { distanceUnit } = useUserPrefs();
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      setAltHeld(e.altKey);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const [position, setPosition] = useState<{
    lng: number;
    lat: number;
    osGrid: OSGridRef | null;
    camera: ml.CameraOptions;
  } | null>(null);

  useEffect(() => {
    if (!manager) return;
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = manager.on("click", e => {
      setPosition(null);
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        return;
      }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;

        let osGrid: OSGridRef | null = null;
        try {
          osGrid = new osgridref.LatLon(lat, lng).toOsGrid();
        } catch (_err) {
          // ignore
        }

        setPosition({
          lng,
          lat,
          osGrid,
          camera: manager.getCamera(),
        });
      }, 300);
    });
    return () => {
      if (clickTimer) clearTimeout(clickTimer);
      sub.unsubscribe();
    };
  }, [manager]);

  const { mutate: mutateElevation, ...elevationMutation } = useMutation(
    trpc.map.elevation.mutationOptions(),
  );

  useEffect(() => {
    if (position) {
      mutateElevation([[position.lng, position.lat]]);
    }
  }, [position, mutateElevation]);

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
    if (!map || !position) return;

    popup.setLngLat([position.lng, position.lat]);
    popup.setDOMContent(container);
    popup.addTo(map);

    return () => {
      popup.remove();
    };
  }, [position, manager, popup, container]);

  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!manager || !position) return;
    const hash = manager.serializeCamera({
      ...position.camera,
      center: position,
    });
    const url = `${window.location.origin}/map#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!position) return null;

  const elevationM = elevationMutation.data?.data[0];
  let elevationDisplay: string;
  if (elevationMutation.isPending) {
    elevationDisplay = "Loading\u2026";
  } else if (elevationM == null) {
    elevationDisplay = "\u2014";
  } else if (distanceUnit === "mi") {
    elevationDisplay = `${(elevationM * METERS_TO_FT).toFixed(0)} ft`;
  } else {
    elevationDisplay = `${elevationM.toFixed(0)} m`;
  }

  return createPortal(
    <div className="relative py-2 text-sm">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pr-7 pl-2 text-base sm:text-xs">
        {position.osGrid && (
          <>
            <span className="text-gray-500">Grid Ref:</span>
            <CopyableValue
              text={position.osGrid.toString(10)}
              successMsg="Grid ref copied"
            />
          </>
        )}
        <span className="text-gray-500">
          {altHeld ? "Lng, lat:" : "Lat, long:"}
        </span>
        <CopyableValue
          text={
            altHeld
              ? `${position.lng.toFixed(5)}, ${position.lat.toFixed(5)}`
              : `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
          }
          successMsg="Coordinates copied"
        />
        <span className="text-gray-500">Elevation:</span>
        <span className="font-medium tracking-wider text-gray-700">
          {elevationDisplay}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t px-2 pt-2">
        <button
          onClick={copyLink}
          className={cn(
            "rounded p-0.5 hover:bg-gray-100",
            copied ? "text-green-600" : "text-gray-600",
          )}
          title="Copy link to position">
          <RiLink size={24} className="h-6 w-6 sm:h-4 sm:w-4" />
        </button>
        <ExternalMapLink
          href={`https://www.google.com/maps/search/?api=1&query=${position.lat}%2C${position.lng}`}
          src="/google-maps-icon.webp"
          title="Open in Google Maps"></ExternalMapLink>
        <ExternalMapLink
          href={`https://explore.osmaps.com/?lat=${position.lat}&lon=${position.lng}&zoom=${position.camera.zoom}&style=Standard&type=2d&droppedPin=${position.lat}%2C${position.lng}`}
          title="Open in OS Maps"
          src="/osmaps-icon.svg"
          className="-ml-0.5"></ExternalMapLink>
        <ExternalMapLink
          href={`https://www.outdooractive.com/r/?page=map&wt=(${position.lat}%2C${position.lng})#zc=${position.camera.zoom! + 1},${position.lng},${position.lat}`}
          src="/outdooractive-icon.webp"
          title="Open in Outdooractive"></ExternalMapLink>
      </div>
      <button
        onClick={() => setPosition(null)}
        className="absolute top-0.5 right-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Close">
        <RiCloseLine size={25} className="sm:h-[16px] sm:w-[16px]" />
      </button>
    </div>,
    container,
  );
}
