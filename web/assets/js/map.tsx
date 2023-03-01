import './map/layout.css';

import { createRoot } from 'react-dom/client';
import MapApp from './map/MapApp';
import * as React from 'react';
import * as ml from 'maplibre-gl';
import { AppStore, initStore } from './map/store';
import { Provider } from 'react-redux';
import { MotionConfig } from 'framer-motion';

declare global {
  interface Window {
    appNode: HTMLElement;
  }
}

window._dbg = {
  computeStyleStats: {
    paintOnlyUpdates: 0,
    fullUpdates: 0,
  },
  sync: {},
};

const rootNode = document.getElementById('map-app-root')!;
window.appNode = rootNode;

const getInit = (prop) => rootNode.dataset[prop]!;
const parseInit = (prop) => JSON.parse(getInit(prop));

const store = initStore({
  id: getInit('mapId'),
  tokens: parseInit('tokens'),
  layerDatas: parseInit('layerDatas'),
  layerSources: parseInit('layerSources'),
  localAware: {
    user: window.currentUser ?? undefined,
    viewAt: parseInit('viewAt'),
  },
});
window._dbg.store = store;

const { disableAnimation } = window.appSettings;

createRoot(rootNode).render(
  <React.StrictMode>
    <Provider store={store}>
      <MotionConfig
        reducedMotion={disableAnimation ? 'always' : 'user'}
        transition={{
          type: 'easeInOut',
          duration: disableAnimation ? 0 : 0.25,
        }}
      >
        <MapApp />
      </MotionConfig>
    </Provider>
  </React.StrictMode>,
);

declare global {
  interface Window {
    _dbg: {
      store?: AppStore;
      mapGL?: ml.Map;
      computeStyleStats: {
        paintOnlyUpdates: number;
        fullUpdates: number;
      };
      sync: {
        yDoc?: unknown;
        idb?: unknown;
        ws?: unknown;
      };
    };
  }
}
