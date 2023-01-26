import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { Map as MapGL } from "maplibre-gl";
import OSExplorerMap from "./map/OSExplorerMap";

const mapGL = new MapGL({
  container: "map-gl",
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

(window as any).mapGL = mapGL;

const osMap = new OSExplorerMap({
  key: "todo",
  attachTo: mapGL,
  loadStart: () => {},
  loadEnd: () => {},
});
