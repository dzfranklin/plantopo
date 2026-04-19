import { useSyncExternalStore } from "react";

export function useUpdateAvailable() {
  return useSyncExternalStore(
    callback => {
      window.addEventListener("spaUpdateChange", callback);
      return () => {
        window.removeEventListener("spaUpdateChange", callback);
      };
    },
    () => window.Native?.spaUpdateAvailable() ?? false,
    () => false,
  );
}
