import { useEffect, useRef } from "react";
import ml from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

export interface MapProps {}

// Note coords are [lng, lat]

export default function AppMap(props: MapProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current === null) {
      return;
    }

    const map = new ml.Map({
      container: ref.current,
      style: "https://demotiles.maplibre.org/style.json", // TODO: Replace w local
      center: [12.550343, 55.665957],
      zoom: 8,
    });

    new ml.Marker().setLngLat([12.550343, 55.665957]).addTo(map);
  }, []);

  return <div ref={ref} className="w-full h-full"></div>;
}
