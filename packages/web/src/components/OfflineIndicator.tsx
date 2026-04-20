import { RiWifiOffLine } from "@remixicon/react";
import type {
  MutationCacheNotifyEvent,
  QueryCacheNotifyEvent,
} from "@tanstack/query-core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/cn";
import { useIsOnline } from "@/hooks/useIsOnline";

function usePauseEvents(onPause: () => void) {
  const client = useQueryClient();
  const onPauseRef = useRef(onPause);
  // eslint-disable-next-line react-hooks/refs
  onPauseRef.current = onPause;

  useEffect(() => {
    const handler = (
      event: QueryCacheNotifyEvent | MutationCacheNotifyEvent,
    ) => {
      if (event.type === "updated" && event.action.type === "pause") {
        onPauseRef.current();
      }
    };
    const unsubQ = client.getQueryCache().subscribe(handler);
    const unsubM = client.getMutationCache().subscribe(handler);
    return () => {
      unsubQ();
      unsubM();
    };
  }, [client]);
}

// Default: always visible while offline, pulses on pause events.
// Fullbleed: hidden normally, flashes in briefly on each pause event then fades out.
export function OfflineIndicator({
  className,
  fullbleed = false,
}: {
  className?: string;
  fullbleed?: boolean;
}) {
  const isOnline = useIsOnline();
  const [flashing, setFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setFlashing(true);
    timer.current = setTimeout(() => setFlashing(false), 1500);
  }, []);

  usePauseEvents(flash);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (fullbleed) {
    return (
      <div
        aria-hidden={!flashing}
        className={cn(
          "flex items-center gap-1.5 text-xs text-amber-700",
          "transition-opacity duration-300",
          flashing ? "opacity-100" : "opacity-0",
          className,
        )}>
        <RiWifiOffLine size={16} />
        <span>Offline</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
        "text-amber-800",
        flashing && "animate-bounce bg-amber-100 ring-1 ring-amber-400",
        className,
      )}>
      <RiWifiOffLine size={16} aria-hidden />
      <span>Offline</span>
    </div>
  );
}
