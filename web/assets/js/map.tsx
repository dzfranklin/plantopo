import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { createRoot } from "react-dom/client";
import MapApp from "./map/MapApp";
import React from "react";

const rootNode = document.getElementById("map-app")!;
const mapboxAccessToken = rootNode.dataset.mapboxAccessToken!;

createRoot(rootNode).render(
  <React.StrictMode>
    <MapApp mapboxAccessToken={mapboxAccessToken} />
  </React.StrictMode>
);
