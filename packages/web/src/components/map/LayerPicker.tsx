import { useQuery } from "@tanstack/react-query";

import type { AppStyleMeta } from "@pt/shared";

import type { SelectedLayers } from "./types";
import { cn } from "@/cn";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const selectedStyle = selected
    ? styles.find(s => s.id === selected.style)
    : undefined;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "overflow-hidden rounded-md border-2 border-white shadow-md outline-1 outline-gray-300",
          "data-[state=open]:outline-2 data-[state=open]:outline-gray-500",
        )}
        aria-label="Select map layer">
        <Thumbnail style={selectedStyle} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-auto gap-0 p-0">
        {styles.map(style => (
          <PopoverClose
            key={style.id}
            onClick={() => onSelect({ style: style.id })}
            className={cn(
              "flex items-center gap-2 p-3 text-left hover:bg-gray-50",
              style.id === selected?.style && "bg-gray-50",
            )}>
            <Thumbnail style={style} />
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                style.id === selected?.style && "font-medium",
              )}>
              {style.name || style.id}
            </span>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Thumbnail({ style }: { style: AppStyleMeta | undefined }) {
  const src = style?.metadata?.["plantopo:thumbnail"];
  const name = style?.name || style?.id;
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={75}
        height={75}
        className="h-[50px] w-[50px] shrink-0 rounded object-cover"
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
      <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded bg-gray-200 text-sm font-semibold text-gray-500">
        {initials || "??"}
      </div>
    );
  }
}
