import { onlineManager } from "@tanstack/react-query";
import { useLayoutEffect, useSyncExternalStore } from "react";

import { getDebugFlag, subscribeDebugFlags } from "./debug-flags";

export function useIsOnline() {
  return useSyncExternalStore(
    callback => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    () => true,
  );
}

// Keeps onlineManager in sync with the apiOffline debug flag so React Query
// itself pauses queries/mutations when the flag is set.
export function useApiOfflineEffect() {
  useLayoutEffect(() => {
    onlineManager.setOnline(!getDebugFlag("apiOffline"));
    const unsubscribe = subscribeDebugFlags(() => {
      onlineManager.setOnline(!getDebugFlag("apiOffline"));
    });
    return () => {
      unsubscribe();
      onlineManager.setOnline(true);
    };
  }, []);
}
