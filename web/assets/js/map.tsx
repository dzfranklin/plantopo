import './map/layout.css';

import { createRoot } from 'react-dom/client';
import MapApp from './map/MapApp';
import * as React from 'react';
import { initStore } from './map/store/store';
import * as ReactRedux from 'react-redux';
import { MotionConfig } from 'framer-motion';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  Provider as SpectrumProvider,
  defaultTheme as spectrumDefaultTheme,
} from '@adobe/react-spectrum';

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
};

const rootNode = document.getElementById('map-app-root')!;
window.appNode = rootNode;

const path = location.pathname.split('/');
const { disableAnimation } = window.appSettings;
const mapId = path.at(-1)!;

const getInit = (prop) => rootNode.dataset[prop]!;
const parseInit = (prop) => JSON.parse(getInit(prop));
const store = initStore({
  id: mapId,
  tokens: parseInit('tokens'),
});
window._dbg.store = store;

const syncToken = parseInit('syncToken');

const queryClient = new QueryClient({});

createRoot(rootNode).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ReactRedux.Provider store={store}>
        <MotionConfig
          reducedMotion={disableAnimation ? 'always' : 'user'}
          transition={{
            type: 'easeInOut',
            duration: disableAnimation ? 0 : 0.2,
          }}
        >
          <SpectrumProvider theme={spectrumDefaultTheme} height={'100%'}>
            <MapApp syncToken={syncToken} />
          </SpectrumProvider>
        </MotionConfig>
      </ReactRedux.Provider>

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);

console.log('Created root');

declare global {
  interface Window {
    _dbg: any;
  }
}
