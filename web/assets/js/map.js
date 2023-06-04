"use strict";
exports.__esModule = true;
require("./map/layout.css");
var client_1 = require("react-dom/client");
var MapApp_1 = require("./map/MapApp");
var React = require("react");
var store_1 = require("./map/store/store");
var ReactRedux = require("react-redux");
var framer_motion_1 = require("framer-motion");
var react_query_1 = require("@tanstack/react-query");
var react_query_devtools_1 = require("@tanstack/react-query-devtools");
window._dbg = {
    computeStyleStats: {
        paintOnlyUpdates: 0,
        fullUpdates: 0
    }
};
var rootNode = document.getElementById('map-app-root');
window.appNode = rootNode;
var path = location.pathname.split('/');
var disableAnimation = window.appSettings.disableAnimation;
var mapId = path.at(-1);
var getInit = function (prop) { return rootNode.dataset[prop]; };
var parseInit = function (prop) { return JSON.parse(getInit(prop)); };
var store = (0, store_1.initStore)({
    id: mapId,
    tokens: parseInit('tokens')
});
window._dbg.store = store;
var syncToken = parseInit('syncToken');
var queryClient = new react_query_1.QueryClient({});
(0, client_1.createRoot)(rootNode).render(<React.StrictMode>
    <react_query_1.QueryClientProvider client={queryClient}>
      <ReactRedux.Provider store={store}>
        <framer_motion_1.MotionConfig reducedMotion={disableAnimation ? 'always' : 'user'} transition={{
        type: 'easeInOut',
        duration: disableAnimation ? 0 : 0.2
    }}>
          <MapApp_1["default"] syncToken={syncToken}/>
        </framer_motion_1.MotionConfig>
      </ReactRedux.Provider>

      <react_query_devtools_1.ReactQueryDevtools initialIsOpen={false}/>
    </react_query_1.QueryClientProvider>
  </React.StrictMode>);
console.log('Created root');
