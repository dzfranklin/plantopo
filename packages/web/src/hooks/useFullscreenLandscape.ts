import { useEffect } from "react";

import logger from "@/logger";

export function useFullscreenLandscape(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      document.documentElement.requestFullscreen();
      // @ts-expect-error lock is unknown
      screen.orientation.lock("landscape");
    } catch (err) {
      logger.warn({ err }, "Failed to enter fullscreen landscape");
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      screen.orientation.unlock();
    };
  }, [enabled]);
}
