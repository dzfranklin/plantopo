import React, { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton.tsx";
import { setDebugFlag, useDebugFlag } from "@/hooks/debug-flags.ts";
import { useFullscreenLandscape } from "@/hooks/useFullscreenLandscape.ts";
import { useIsDesktop } from "@/hooks/useMediaQuery.ts";
import { cn } from "@/util/cn";

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import("@tanstack/react-query-devtools/build/modern/production.js").then(
    d => ({
      default: d.ReactQueryDevtoolsPanel,
    }),
  ),
);

export function QueryDevtoolsPanel() {
  const isOpen = useDebugFlag("openQueryDevtools");
  const isDesktop = useIsDesktop();
  const close = () => setDebugFlag("openQueryDevtools", false);

  useFullscreenLandscape(isOpen && !isDesktop);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] sm:inset-x-0 sm:top-auto sm:bottom-0">
      <div className="relative">
        <Suspense
          fallback={<Skeleton className="h-[500px] w-full rounded-none" />}>
          <ReactQueryDevtoolsProduction
            onClose={close}
            style={{
              width: "100dvw",
              height: "min(500px, 100dvh)",
              border: "1px solid #e5e7eb",
            }}
          />
        </Suspense>
        <button
          onClick={close}
          className={cn(
            "absolute cursor-pointer rounded border border-[#e5e7eb] bg-[#f9fafb] text-xs text-[#d0d5dd] hover:bg-[#f0f1f3] hover:text-[#111815]",
            isDesktop
              ? "-top-8 right-2 px-2 py-0.5"
              : "top-2 left-2 px-3 py-1.5",
          )}>
          ✕ Close
        </button>
      </div>
    </div>
  );
}
