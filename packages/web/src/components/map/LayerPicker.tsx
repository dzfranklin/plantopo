import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";

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
    <Popover.Root>
      <Popover.Anchor className="flex flex-col items-end gap-2 select-none">
        <div className="relative">
          <Popover.Trigger
            className={cn(
              "overflow-hidden rounded-md border-2 border-white shadow-md outline-1 outline-gray-300",
              "data-[state=open]:outline-2 data-[state=open]:outline-gray-500",
            )}
            aria-label="Select map layer">
            <Thumbnail style={selectedStyle} size="md" />
          </Popover.Trigger>
          {selectedOverlays.size > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white tabular-nums">
              {selectedOverlays.size}
            </span>
          )}
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          data-layer-picker
          className={cn(
            "rounded-lg border border-gray-200 bg-white p-4 shadow-lg",
            "flex flex-col gap-4",
            "max-w-[calc(100vw-1rem)] overflow-y-auto",
            "max-sm:max-h-[80svh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-b-none",
            "origin-bottom-right",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "duration-200",
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
