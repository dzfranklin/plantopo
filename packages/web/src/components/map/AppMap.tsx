import { useState } from "react";

import { MapView } from "./MapView";
import type { MapProps } from "./types";
import { BUILTIN_STYLE_META, BuiltinBaseStyleSchema } from "./types";
import { useSession, useUserPrefs } from "@/auth/auth-client";
import { cn } from "@/cn";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Layer = {
  label: string;
  thumbnail: React.ReactNode;
  style: MapProps["baseStyle"];
};

const BUILTIN_LAYERS: Layer[] = BuiltinBaseStyleSchema.options.map(id => {
  const { label, thumbnail } = BUILTIN_STYLE_META[id];
  return {
    label,
    thumbnail: (
      <img
        src={thumbnail}
        alt={label}
        width={75}
        height={75}
        className="h-[50px] w-[50px] shrink-0 rounded object-cover"
      />
    ),
    style: id,
  };
});

function CustomThumbnail({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded bg-gray-200 text-sm font-semibold text-gray-500">
      {initials || "?"}
    </div>
  );
}

function LayerPicker({
  layers,
  selected,
  onSelect,
}: {
  layers: Layer[];
  selected: Layer;
  onSelect: (layer: Layer) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "overflow-hidden rounded-md border-2 border-white shadow-md outline-1 outline-gray-300",
          "data-[state=open]:outline-2 data-[state=open]:outline-gray-500",
        )}
        aria-label="Select map layer">
        {selected.thumbnail}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-auto gap-0 p-0">
        {layers.map(layer => (
          <PopoverClose
            key={layer.label}
            onClick={() => onSelect(layer)}
            className={cn(
              "flex items-center gap-2 p-3 text-left hover:bg-gray-50",
              layer.label === selected.label && "bg-gray-50",
            )}>
            {layer.thumbnail}
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                layer.label === selected.label && "font-medium",
              )}>
              {layer.label}
            </span>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}

type AppMapProps = Omit<MapProps, "baseStyle" | "distanceUnit">;

export function AppMap(props: AppMapProps) {
  const prefs = useUserPrefs();
  const session = useSession();
  const [selected, setSelected] = useState<Layer>(BUILTIN_LAYERS[0]!);

  const allLayers: Layer[] = [
    ...BUILTIN_LAYERS,
    ...Object.entries(prefs.customBaseStylesByName).map(([name, style]) => ({
      label: name,
      thumbnail: <CustomThumbnail name={name} />,
      style,
    })),
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapView
        {...props}
        baseStyle={selected.style}
        distanceUnit={prefs.distanceUnit}
        tileKey={session.data?.user.tileKey}
      />
      <div className="absolute right-2 bottom-8 z-10">
        <LayerPicker
          layers={allLayers}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}
