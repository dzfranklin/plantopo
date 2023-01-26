import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { createRoot } from "react-dom/client";
import MapApp from "./map/MapApp";
import React from "react";

createRoot(document.getElementById("map-app")!).render(
  <React.StrictMode>
    <MapApp />
  </React.StrictMode>
);
