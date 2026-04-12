import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { AppStyleMeta } from "@pt/shared";

import type { SelectedLayers } from "./types";
import { cn } from "@/cn";
import { useTRPC } from "@/trpc";
import { by } from "@/util";

export function LayerPicker({
  selected,
  onSelect,
}: {
  selected: SelectedLayers | null;
  onSelect: (v: SelectedLayers) => void;
}) {
  const trpc = useTRPC();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const catalogQuery = useQuery(
    trpc.map.catalog.queryOptions(undefined, {
      staleTime: Infinity,
      gcTime: Infinity,
    }),
  );
  if (!catalogQuery.data) {
    return null;
  }

  const styles = Object.values(catalogQuery.data.styles).sort(by("name", "id"));
  const overlays = Object.values(catalogQuery.data.overlays).sort(
    by("name", "id"),
  );
  const selectedStyle = selected
    ? styles.find(s => s.id === selected.style)
    : undefined;

  const selectedOverlays = new Set(selected?.overlays ?? []);

  function toggleOverlay(id: string) {
    const current = selected?.overlays ?? [];
    const next = current.includes(id)
      ? current.filter(o => o !== id)
      : [...current, id];
    onSelect({ ...(selected ?? { style: "default" }), overlays: next });
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-end gap-2 select-none">
      <div
        className={cn(
          "rounded-lg border border-gray-200 bg-white p-4 shadow-lg",
          "flex flex-col gap-4",
          "origin-bottom-right transition-all duration-200",
          open
            ? "visible scale-100 opacity-100"
            : "invisible scale-95 opacity-0",
        )}>
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Map
          </h2>
          <div className="flex flex-wrap gap-2">
            {styles.map(style => (
              <button
                key={style.id}
                onClick={() =>
                  onSelect({
                    ...(selected ?? { style: "default", overlays: [] }),
                    style: style.id,
                  })
                }
                className="flex flex-col items-center gap-1 rounded-md p-1 text-left hover:bg-gray-50">
                <Thumbnail
                  style={style}
                  size="md"
                  active={style.id === selected?.style}
                />
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    style.id === selected?.style && "font-medium",
                  )}>
                  {style.name || style.id}
                </span>
              </button>
            ))}
          </div>
        </section>

        {overlays.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Overlays
            </h2>
            <div className="flex flex-wrap gap-2">
              {overlays.map(overlay => (
                <button
                  key={overlay.id}
                  onClick={() => toggleOverlay(overlay.id)}
                  className="flex flex-col items-center gap-1 rounded-md p-1 text-left hover:bg-gray-50">
                  <Thumbnail
                    style={overlay}
                    size="sm"
                    active={selectedOverlays.has(overlay.id)}
                  />
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      selectedOverlays.has(overlay.id) && "font-medium",
                    )}>
                    {overlay.name || overlay.id}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "overflow-hidden rounded-md border-2 border-white shadow-md outline-1 outline-gray-300",
          open && "outline-2 outline-gray-500",
        )}
        aria-label="Select map layer">
        <Thumbnail style={selectedStyle} size="md" />
      </button>
    </div>
  );
}

function Thumbnail({
  style,
  size,
  active,
}: {
  style: AppStyleMeta | undefined;
  size: "md" | "sm";
  active?: boolean;
}) {
  const src = style?.metadata?.["plantopo:thumbnail"];
  const name = style?.name || style?.id;
  const sizeClass = size === "md" ? "h-[50px] w-[50px]" : "h-[34px] w-[34px]";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          "shrink-0 rounded object-cover",
          sizeClass,
          active && "outline-2 outline-offset-1 outline-blue-500",
        )}
      />
    );
  } else {
    const initials = name
      ?.split(/\s+/)
      ?.map(w => w[0])
      ?.join("")
      ?.slice(0, 2)
      ?.toUpperCase();
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded bg-gray-200 text-sm font-semibold text-gray-500",
          sizeClass,
          active && "outline-2 outline-offset-1 outline-blue-500",
        )}>
        {initials || "??"}
      </div>
    );
  }
}
