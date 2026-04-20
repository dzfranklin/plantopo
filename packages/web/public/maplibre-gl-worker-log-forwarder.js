(function () {
  if (globalThis.__MAPLIBRE_GL_WORKER_LOG_FORWARDER_REGISTERED__) {
    console.info(
      "[maplibre-gl-worker-log-forwarder] Log forwarder already registered, skipping duplicate registration",
    );
    return;
  }
  globalThis.__MAPLIBRE_GL_WORKER_LOG_FORWARDER_REGISTERED__ = true;

  if (typeof globalThis.BroadcastChannel === "undefined") {
    console.warn(
      "[maplibre-gl-worker-log-forwarder] BroadcastChannel is not supported in this environment, log forwarding will be disabled",
    );
    return;
  }

  const channel = new BroadcastChannel("plantopo-maplibre-worker-logs");

  const originalConsole = globalThis.console;
  patchConsole();

  let clientID = null;

  self.worker.actor.registerMessageHandler(
    "_plantopo_log_forwarder_connect",
    async (_mapId, { clientID: newClientID }) => {
      if (clientID !== null) {
        if (clientID !== newClientID) {
          originalConsole.warn(
            "[maplibre-gl-worker-log-forwarder] Received connect message with clientID",
            newClientID,
            "but already connected with clientID",
            clientID,
            "overwriting clientID and continuing to forward logs to the new clientID",
          );
        }
        return;
      }

      clientID = newClientID;
      originalConsole.info(
        "[maplibre-gl-worker-log-forwarder] Connected to client with clientID",
        clientID,
      );
    },
  );

  function postLog(method, args) {
    channel.postMessage({ clientID, method, args });
  }

  function patchConsole() {
    const messageMethods = ["log", "trace", "debug", "info", "warn", "error"];
    Object.defineProperty(globalThis, "console", {
      value: new Proxy(originalConsole, {
        get(target, prop) {
          if (messageMethods.includes(prop)) {
            return function (...args) {
              postLog(prop, args);
              target[prop](...args);
            };
          } else {
            return target[prop];
          }
        },
      }),
    });
  }
})();
