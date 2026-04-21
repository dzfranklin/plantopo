import { RiCloseLine, RiLink } from "@remixicon/react";
import { skipToken, useQuery } from "@tanstack/react-query";
import OSGridRef, * as osgridref from "geodesy/osgridref.js";
import ml from "maplibre-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { METERS_TO_FT, type Point } from "@pt/shared";

import { useMapManager } from "./MapManagerContext";
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

function CopyableValue({ text }: { text: string }) {
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => toast.success("Copied!"))
      }
      className="text-left font-medium tracking-wider text-gray-700 hover:text-blue-800"
      title="Click to copy">
      {text}
    </button>
  );
}

export function PointInfoPopup() {
  const manager = useMapManager();
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
    point: Point;
    osGrid: OSGridRef | null;
    camera: ml.CameraOptions;
  } | null>(null);

  useEffect(() => {
    if (!manager || !manager.map) return;

    const map = manager.map;
    const canvas = map.getCanvas();

    const subscription = (e: PointerEvent) => {
      e.preventDefault();
      const { lng, lat } = map.unproject([e.offsetX, e.offsetY]);

      let osGrid: OSGridRef | null = null;
      try {
        osGrid = new osgridref.LatLon(lat, lng).toOsGrid();
      } catch (_err) {
        // ignore
      }

      setPosition({
        point: [lng, lat],
        osGrid,
        camera: manager.getCamera(),
      });
    };
    canvas.addEventListener("contextmenu", subscription);

    return () => {
      canvas.removeEventListener("contextmenu", subscription);
    };
  }, [manager]);

  const elevationQuery = useQuery(
    trpc.elevation.point.queryOptions(position ? position.point : skipToken, {
      staleTime: Infinity,
      throwOnError: false,
    }),
  );

  const reverseGeocodeQuery = useQuery(
    trpc.geocoder.reverseGeocode.queryOptions(
      position ? { point: position.point, limit: 1 } : skipToken,
      { staleTime: Infinity, throwOnError: false },
    ),
  );

  const [container] = useState(() => document.createElement("div"));
  const [popup] = useState(
    () =>
      new ml.Popup({
        closeButton: false,
        maxWidth: "none",
        className: "[&_.maplibregl-popup-content]:!p-0",
      }),
  );

  useEffect(() => {
    const map = manager?.map;
    if (!map || !position) return;

    popup.setLngLat(position.point);
    popup.setDOMContent(container);
    popup.addTo(map);

    return () => {
      popup.remove();
    };
  }, [position, manager, popup, container]);

  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!manager || !position) return;
    const camera = manager.serializeCamera({
      ...position.camera,
      center: position.point,
    });
    const currentHash = location.hash.slice(1);
    const lParam = currentHash.split("&").find(p => p.startsWith("l="));
    const hash = lParam ? `c=${camera}&${lParam}` : camera;
    const url = `${window.location.origin}/map#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!position) return null;

  const elevationM = elevationQuery.data?.data;
  let elevationDisplay: string;
  if (elevationQuery.isPending) {
    elevationDisplay = "Loading\u2026";
  } else if (elevationM == null) {
    elevationDisplay = "\u2014";
  } else if (distanceUnit === "mi") {
    elevationDisplay = `${(elevationM * METERS_TO_FT).toFixed(0)} ft`;
  } else {
    elevationDisplay = `${elevationM.toFixed(0)} m`;
  }

  const reverseGeocode = reverseGeocodeQuery.data?.[0];

  return createPortal(
    <div className="relative min-w-[260px] py-2 text-sm">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pr-7 pl-2 text-base sm:text-xs">
        {position.osGrid && (
          <>
            <span className="text-gray-500">Grid Ref:</span>
            <CopyableValue text={position.osGrid.toString(10)} />
          </>
        )}
        <span className="text-gray-500">
          {altHeld ? "Lng, lat:" : "Lat, long:"}
        </span>
        <CopyableValue
          text={
            altHeld
              ? `${position.point[0].toFixed(5)}, ${position.point[1].toFixed(5)}`
              : `${position.point[1].toFixed(5)}, ${position.point[0].toFixed(5)}`
          }
        />
        <span className="text-gray-500">Elevation:</span>
        <span className="font-medium tracking-wider text-gray-700">
          {elevationDisplay}
        </span>
        <span className="text-gray-500">Location:</span>
        {reverseGeocodeQuery.isPending ? (
          <span className="font-medium tracking-wider text-gray-700">
            Loading&hellip;
          </span>
        ) : reverseGeocode?.properties.label ? (
          <CopyableValue text={reverseGeocode.properties.label} />
        ) : (
          <span className="font-medium tracking-wider text-gray-700">
            &mdash;
          </span>
        )}
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
          href={`https://www.google.com/maps/search/?api=1&query=${position.point[1]}%2C${position.point[0]}`}
          src="/google-maps-icon.webp"
          title="Open in Google Maps"></ExternalMapLink>
        <ExternalMapLink
          href={`https://explore.osmaps.com/?lat=${position.point[1]}&lon=${position.point[0]}&zoom=${position.camera.zoom}&style=Standard&type=2d&droppedPin=${position.point[1]}%2C${position.point[0]}`}
          title="Open in OS Maps"
          src="/osmaps-icon.svg"
          className="-ml-0.5"></ExternalMapLink>
        <ExternalMapLink
          href={`https://www.outdooractive.com/r/?page=map&wt=(${position.point[1]}%2C${position.point[0]})#zc=${position.camera.zoom! + 1},${position.point[0]},${position.point[1]}`}
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
