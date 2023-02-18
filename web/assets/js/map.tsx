import "./map/layout.css";
import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { createRoot } from "react-dom/client";
import MapApp from "./map/MapApp";
import * as React from "react";
import { Map as MapGL } from "maplibre-gl";
import { AppStore, initStore } from "./map/store";
import { Provider } from "react-redux";

const rootNode = document.getElementById("map-app-root")!;

const store = initStore(JSON.parse(rootNode.dataset.preloadedState!));

createRoot(rootNode).render(
  <React.StrictMode>
    <Provider store={store}>
      <MapApp />
    </Provider>
  </React.StrictMode>
);

declare global {
  interface Window {
    _dbg: {
      store: AppStore;
      mapGL: MapGL;
    };
  }
}

window._dbg = { store, mapGL: null as MapGL };
