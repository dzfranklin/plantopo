import ml from "maplibre-gl";
import { useEffect, useRef } from "react";

import { useMapManager } from "./MapManagerContext";

interface MapMarkerProps extends ml.MarkerOptions {
  lngLat: ml.LngLatLike;
}

export function MapMarker({ lngLat, ...forwardedOptions }: MapMarkerProps) {
  const manager = useMapManager();
  const markerRef = useRef<ml.Marker | null>(null);

  useEffect(() => {
    const options = {
      ...forwardedOptions,
      color: forwardedOptions.color ?? "#007595", // primary
    };

    const marker = new ml.Marker(options).setLngLat(lngLat).addTo(manager.map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // I want the initial value of lngLat and options to be captured here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager]);

  useEffect(() => {
    markerRef.current?.setLngLat(lngLat);
  }, [lngLat]);

  return null;
}
