import React, {
  useRef,
  MutableRefObject,
  useEffect,
  RefObject,
  useState,
} from "react";
import { Map as MapGL } from "maplibre-gl";
import OSExplorerMap, { osAttribLayerId } from "./OSExplorerMap";
import LoadingIndicator from "./LoadingIndicator";
import classNames from "../classNames";

export default function MapApp() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapGL>();
  // Whether we need to credit the ordnance survey
  const [creditOS, setCreditOS] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(false);
  useMap(mapRef, mapNodeRef, setCreditOS, setIsMapLoading);

  return (
    <div className="w-full h-full grid grid-cols-[1fr] grid-rows-[1fr]">
      <LoadingIndicator isLoading={isMapLoading} />
      <AttributionImages creditOS={creditOS} />
      <div ref={mapNodeRef} className="col-span-full row-span-full" />
    </div>
  );
}

function useMap(
  mapRef: MutableRefObject<MapGL | undefined>,
  nodeRef: RefObject<HTMLDivElement>,
  setCreditOS: (show: boolean) => void,
  setIsMapLoading: (isLoading: boolean) => void
) {
  const isLoading = useRef({
    gl: false,
    ol: false,
  });
  const updateLoading = (update) => {
    const prevVal = isLoading.current.gl || isLoading.current.ol;
    isLoading.current = { ...isLoading.current, ...update };
    const newVal = isLoading.current.gl || isLoading.current.ol;
    setIsMapLoading(newVal);
  };

  useEffect(() => {
    if (!mapRef.current) {
      const map = new MapGL({
        container: nodeRef.current!,
        minZoom: 6,
        maxZoom: 18,
        style: "http://geder:4003/maps/vector/v1/vts/resources/styles?key",
        maxBounds: [
          [-10.76418, 49.528423],
          [1.9134116, 61.331151],
        ],
        center: [-2.968, 54.425],
        zoom: 13,
        maxPitch: 0, // OL doesn't support pitch
        keyboard: false,
        transformRequest: (url) => {
          if (url.startsWith("http://geder:4003/")) {
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

      map.on("dataloading", () => updateLoading({ gl: !map.areTilesLoaded() }));
      map.on("dataabort", () => updateLoading({ gl: !map.areTilesLoaded() }));
      map.on("data", () => updateLoading({ gl: !map.areTilesLoaded() }));

      map.on("data", () => {
        if (map.getLayer(osAttribLayerId)) {
          setCreditOS(true);
        } else {
          setCreditOS(false);
        }
      });

      const osMap = new OSExplorerMap({
        key: "todo",
        attachTo: map,
        loadStart: () => () => updateLoading({ ol: true }),
        loadEnd: () => updateLoading({ ol: false }),
      });
    }
  }, []);
}

function AttributionImages(props: { creditOS: boolean }) {
  return (
    <div className="absolute bottom-0 left-0 z-10 pointer-events-none">
      <div className="flex flex-row gap-2 h-[24px] m-[4px]">
        <img src="/images/mapbox_logo.svg" className="h-full" />
        <img
          src="/images/os_logo.svg"
          className={classNames("h-full", props.creditOS || "hidden")}
        />
      </div>
    </div>
  );
}
