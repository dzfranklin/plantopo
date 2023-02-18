import "./map/layout.css";
import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { createRoot } from "react-dom/client";
import MapApp from "./map/MapApp";
import * as React from "react";
import { Map as MapGL } from "maplibre-gl";
import { AppStore, initStore } from "./map/store";
import { Provider } from "react-redux";

import coreWasm from "../../../core/pkg/plantopo_core_bg.wasm";
import initCore from "../../../core/pkg/plantopo_core";

const rootNode = document.getElementById("map-app-root")!;

const store = initStore(JSON.parse(rootNode.dataset.preloadedState!));

createRoot(rootNode).render(
  <React.StrictMode>
    <Provider store={store}>
      <MapApp />
    </Provider>
  </React.StrictMode>
);

async function setupCore() {
  return await initCore("/assets/" + coreWasm);
}

declare global {
  interface Window {
    _dbg: {
      store: AppStore;
      mapGL: MapGL;
    };
  }
}

window._dbg = { store, mapGL: null as MapGL };
