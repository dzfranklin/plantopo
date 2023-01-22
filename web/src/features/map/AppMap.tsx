import { RefObject, useEffect, useRef, useState } from "react";
import { Map as GlMap } from "maplibre-gl";
import { OLLayer } from "./ol/OLLayer";
import OlTile from "ol/layer/Tile";
import OlXYZ from "ol/source/XYZ";
import proj4 from "proj4";
import { register as registerOlProj4 } from "ol/proj/proj4";
import TileGrid from "ol/tilegrid/TileGrid";
import "maplibre-gl/dist/maplibre-gl.css";

const tempOSKey = "REDACTED";

export interface MapProps {}

export function AppMapDemo() {
  return <AppMap />;
}

export default function AppMap(props: MapProps) {
  const mapNode = useRef<HTMLDivElement>(null);
  const osLeisureNode = useRef<HTMLDivElement>(null);
  const map = useMap(mapNode, osLeisureNode);

  return (
    <div className="w-full h-full">
      <div
        ref={osLeisureNode}
        className="absolute inset-0 pointer-events-none"
      ></div>
      <div ref={mapNode} className="absolute inset-0"></div>
    </div>
  );
}

function useMap(
  targetRef: RefObject<HTMLDivElement>,
  osLeisureTargetRef: RefObject<HTMLDivElement>
) {
  const mapRef = useRef<GlMap | null>(null);

  useEffect(() => {
    const target = targetRef.current!;
    const osLeisureTarget = osLeisureTargetRef.current!;

    if (mapRef.current === null) {
      const map = new GlMap({
        container: target,
        style: "https://demotiles.maplibre.org/style.json", // stylesheet location
        center: [52.923, -3.216], // starting position [lng, lat]
        zoom: 6, // starting zoom
        hash: true,
      });

      map.on("load", () => {
        map.addLayer(createOSLeisureLayer(osLeisureTarget));
      });

      mapRef.current = map;
    }
  }, [osLeisureTargetRef, targetRef]);
}

function createOSLeisureLayer(target: HTMLDivElement) {
  // Setup the EPSG:27700 (British National Grid) projection.
  proj4.defs(
    "EPSG:27700",
    "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs"
  );
  registerOlProj4(proj4);

  const tilegrid = new TileGrid({
    resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
    origin: [-238375.0, 1376256.0],
  });

  return new OLLayer({
    target,
    layers: [
      new OlTile({
        source: new OlXYZ({
          url:
            "https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key=" +
            tempOSKey,
          projection: "EPSG:27700",
          tileGrid: tilegrid,
        }),
      }),
    ],
  });
}
