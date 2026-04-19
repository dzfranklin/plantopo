import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { VisuallyHidden } from "radix-ui";
import { Drawer } from "vaul";

import { type AppStyleMeta, by } from "@pt/shared";

import type { SelectedLayers } from "./types";
import { cn } from "@/cn";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { useTRPC } from "@/trpc";

export function LayerPicker({
  selected,
  onSelect,
}: {
  selected: SelectedLayers | null;
  onSelect: (v: SelectedLayers) => void;
}) {
  const trpc = useTRPC();
  const isDesktop = useIsDesktop();

  const catalogQuery = useQuery(
    trpc.map.catalog.queryOptions(undefined, {
      staleTime: Infinity,
      gcTime: Infinity,
    }),
  );
  if (!catalogQuery.data) {
    return null;
  }

  const styles = Object.values(catalogQuery.data.styles).sort(by("name"));
  const overlays = Object.values(catalogQuery.data.overlays).sort(by("name"));
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

  const trigger = (
    <div
      className={cn(
        "relative select-none",
        "rounded-md border-2 border-white shadow-md outline-1 outline-gray-300",
        "data-[state=open]:outline-2 data-[state=open]:outline-gray-500",
      )}
      aria-label="Select map layer">
      <LayerThumbnail
        style={selectedStyle}
        size="md"
        className="overflow-hidden rounded-[4px]"
      />
      {selectedOverlays.size > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white tabular-nums">
          {selectedOverlays.size}
        </span>
      )}
    </div>
  );

  const content = (
    <LayerPickerContent
      styles={styles}
      overlays={overlays}
      selected={selected}
      selectedOverlays={selectedOverlays}
      onSelect={onSelect}
      toggleOverlay={toggleOverlay}
    />
  );

  if (isDesktop) {
    return (
      <Popover.Root modal={true}>
        <Popover.Anchor className="flex flex-col items-end gap-2 select-none">
          <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={8}
            className={cn(
              "rounded-lg border border-gray-200 bg-white p-4 shadow-lg",
              "flex flex-col gap-4",
              "max-w-[calc(100vw-1rem)] overflow-y-auto",
              "origin-bottom-right",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "duration-200",
            )}>
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border border-gray-200 bg-white outline-none">
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-gray-300" />
          <VisuallyHidden.Root>
            <Drawer.Title>Select layers</Drawer.Title>
          </VisuallyHidden.Root>
          <div className="flex max-h-[80svh] flex-col gap-4 overflow-y-auto p-4">
            {content}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function LayerPickerContent({
  styles,
  overlays,
  selected,
  selectedOverlays,
  onSelect,
  toggleOverlay,
}: {
  styles: AppStyleMeta[];
  overlays: AppStyleMeta[];
  selected: SelectedLayers | null;
  selectedOverlays: Set<string>;
  onSelect: (v: SelectedLayers) => void;
  toggleOverlay: (id: string) => void;
}) {
  return (
    <>
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Map
        </h2>
        <div className="flex flex-wrap gap-2">
          {styles.map(style => (
            <LayerItem
              key={style.id}
              style={style}
              size="md"
              active={style.id === selected?.style}
              onClick={() =>
                onSelect({
                  ...(selected ?? { style: "default", overlays: [] }),
                  style: style.id,
                })
              }
            />
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
              <LayerItem
                key={overlay.id}
                style={overlay}
                size="sm"
                active={selectedOverlays.has(overlay.id)}
                onClick={() => toggleOverlay(overlay.id)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function LayerItem({
  style,
  size,
  active,
  onClick,
}: {
  style: AppStyleMeta;
  size: "md" | "sm";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-md p-1 text-left hover:bg-gray-50">
      <LayerThumbnail style={style} size={size} active={active} />
      <span
        className={cn("text-xs whitespace-nowrap", active && "font-medium")}>
        {style.name || style.id}
      </span>
    </button>
  );
}

export function LayerThumbnail({
  style,
  size,
  active,
  className,
}: {
  style: AppStyleMeta | undefined;
  size: "md" | "sm";
  active?: boolean;
  className?: string;
}) {
  const src = style?.metadata?.["plantopo:thumbnail"];
  const name = style?.name || style?.id;
  const sizeClass =
    size === "md"
      ? "h-[64px] w-[64px] sm:h-[50px] sm:w-[50px]"
      : "h-[44px] w-[44px] sm:h-[34px] sm:w-[34px]";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          "shrink-0 rounded object-cover",
          sizeClass,
          active && "outline-2 outline-offset-1 outline-blue-500",
          className,
        )}
      />
    );
  }

  const initials = name
    ?.split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded bg-gray-200 text-sm font-semibold text-gray-500",
        sizeClass,
        active && "outline-2 outline-offset-1 outline-blue-500",
        className,
      )}>
      {initials || "??"}
    </div>
  );
}
