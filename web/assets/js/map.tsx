import "./map/layout.css";
import "../node_modules/maplibre-gl/dist/maplibre-gl.css";

import { createRoot } from "react-dom/client";
import MapApp from "./map/MapApp";
import * as React from "react";
import * as ml from "maplibre-gl";
import { AppStore, initStore } from "./map/store";
import { Provider } from "react-redux";
import { MotionConfig, useReducedMotion } from "framer-motion";

declare global {
  interface Window {
    appNode: HTMLElement;
    _dbg: {
      store: AppStore;
      mapGL: ml.Map;
      computeStyleStats: {
        paintOnlyUpdates: number;
        fullUpdates: number;
      };
    };
  }
}
window._dbg = {
  computeStyleStats: {
    paintOnlyUpdates: 0,
    fullUpdates: 0,
  },
} as any;

const rootNode = document.getElementById("map-app-root")!;
window.appNode = rootNode;

const store = initStore(JSON.parse(rootNode.dataset.preloadedState!));
window._dbg.store = store;

const { disableAnimation } = window.userSettings;

createRoot(rootNode).render(
  <React.StrictMode>
    <Provider store={store}>
      <MotionConfig
        reducedMotion={disableAnimation ? "always" : "user"}
        transition={{
          type: "easeInOut",
          duration: disableAnimation ? 0 : 0.25,
        }}
      >
        <MapApp />
      </MotionConfig>
    </Provider>
  </React.StrictMode>
);
