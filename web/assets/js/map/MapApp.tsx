import React, { useRef, MutableRefObject, useEffect, RefObject } from "react";
import { Map as MapGL } from "maplibre-gl";
import OSExplorerMap from "./OSExplorerMap";

export default function MapApp() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapGL>();
  useMap(mapRef, mapNodeRef);

  return (
    <div className="w-full h-full grid grid-cols-[1fr] grid-rows-[1fr]">
      <div ref={mapNodeRef} className="col-span-full row-span-full"></div>
    </div>
  );
}

function useMap(
  mapRef: MutableRefObject<MapGL | undefined>,
  nodeRef: RefObject<HTMLDivElement>
) {
  useEffect(() => {
    if (!mapRef.current) {
      const map = new MapGL({
        container: nodeRef.current!,
        minZoom: 6,
        maxZoom: 18,
        style: "http://localhost:4003/maps/vector/v1/vts/resources/styles?key",
        maxBounds: [
          [-10.76418, 49.528423],
          [1.9134116, 61.331151],
        ],
        center: [-2.968, 54.425],
        zoom: 13,
        maxPitch: 0, // OL doesn't support pitch
        keyboard: false,
        transformRequest: (url) => {
          if (url.startsWith("http://localhost:4003/")) {
            return {
              url: url + "&srs=3857",
              headers: { Authorization: "Bearer todo" },
            };
          } else {
            return { url };
          }
        },
        hash: true,
      });
      mapRef.current = map;

      map.keyboard.disable(); // We'll handle keyboard shortcuts centrally

      // We disable rotation because our OL sync code doesn't handle it
      map.dragRotate.disable();
      map.touchZoomRotate.disable();

      const osMap = new OSExplorerMap({
        key: "todo",
        attachTo: map,
        loadStart: () => {},
        loadEnd: () => {},
      });
    }
  }, []);
}
