import './map/layout.css';

import { createRoot } from 'react-dom/client';
import MapApp from './map/MapApp';
import * as React from 'react';
import { initStore } from './map/store/store';
import * as ReactRedux from 'react-redux';
import { MotionConfig } from 'framer-motion';
import { MapSyncProvider } from './map/sync/context';

declare global {
  interface Window {
    appNode: HTMLElement;
  }
}

window._dbg = {
  loadTime: performance.now(),
  computeStyleStats: {
    paintOnlyUpdates: 0,
    fullUpdates: 0,
  },
  sync: {
    verboseLogs: false,
  },
};

const _debug = window.console.debug;
window.console.debug = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[SyncY')) {
    // Suppress noisy logs from y-redux
    if (!window._dbg.sync.verboseLogs) return;
  }
  _debug(...args);
};

const rootNode = document.getElementById('map-app-root')!;
window.appNode = rootNode;

const searchParams = new URLSearchParams(location.search);
const path = location.pathname.split('/');
const { disableAnimation } = window.appSettings;
const enableLocalSave = !searchParams.has('noLocal');
const mapId = path.at(-1)!;

const getInit = (prop) => rootNode.dataset[prop]!;
const parseInit = (prop) => JSON.parse(getInit(prop));
const store = initStore({
  id: mapId,
  tokens: parseInit('tokens'),
  layerDatas: parseInit('layerDatas'),
  layerSources: parseInit('layerSources'),
});
window._dbg.store = store;

createRoot(rootNode).render(
  <React.StrictMode>
    <ReactRedux.Provider store={store}>
      <MapSyncProvider id={mapId} enableLocalSave={enableLocalSave}>
        <MotionConfig
          reducedMotion={disableAnimation ? 'always' : 'user'}
          transition={{
            type: 'easeInOut',
            duration: disableAnimation ? 0 : 0.2,
          }}
        >
          <MapApp />
        </MotionConfig>
      </MapSyncProvider>
    </ReactRedux.Provider>
  </React.StrictMode>,
);

declare global {
  interface Window {
    _dbg: {
      loadTime: number;
      store?: any;
      mapGL?: any;
      computeStyleStats: {
        paintOnlyUpdates: number;
        fullUpdates: number;
      };
      sync: {
        verboseLogs: boolean;
        core?: any;
      };
    };
  }
}
