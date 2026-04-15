import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { AppStyle } from "@pt/shared";

import { MapView } from "../components/map/MapView";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { MapManager } from "@/components/map/MapManager";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc";

const SAMPLE_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.5, 53.0] },
      properties: {
        "marker-color": "#e03030",
        "marker-size": "large",
        title: "Red marker",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.2, 53.1] },
      properties: {
        "marker-color": "#3060e0",
        "marker-size": "small",
        title: "Blue marker",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-1.6, 52.9],
          [-1.4, 53.05],
          [-1.1, 52.95],
        ],
      },
      properties: {
        stroke: "#e08030",
        "stroke-width": 4,
        "stroke-opacity": 0.8,
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-1.55, 53.1],
            [-1.3, 53.1],
            [-1.3, 52.95],
            [-1.55, 52.95],
            [-1.55, 53.1],
          ],
        ],
      },
      properties: {
        fill: "#30a030",
        "fill-opacity": 0.4,
        stroke: "#206020",
        "stroke-width": 2,
      },
    },
  ],
};

MapManager.trace = true;

const hasDisabledStrictMode = localStorage.getItem("_disableStrictMode");
if (hasDisabledStrictMode) {
  localStorage.removeItem("_disableStrictMode");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fireWrapper(this: NonNullable<MapManager["_m"]>, event: any) {
  console.log(
    "Map event:",
    event.type,
    "isStyleLoaded: " + this.isStyleLoaded(),
  );
  // @ts-expect-error does not exist
  return this.__originalFire?.(event);
}

export default function DevMapPage() {
  const [interactive, setInteractive] = useState(true);
  const [hash, setHash] = useState(true);
  const [geojsonEnabled, setGeojsonEnabled] = useState(false);
  const [customGeojson, setCustomGeojson] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [count, setCount] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("undefined");
  const [terrainProp, setTerrainProp] = useState<
    "uncontrolled" | "true" | "false"
  >("uncontrolled");
  const [logEvents, setLogEvents] = useState(false);

  const trpc = useTRPC();
  const catalogQuery = useQuery(trpc.map.catalog.queryOptions());
  const styleOptions = catalogQuery.data
    ? Object.keys(catalogQuery.data.styles).sort()
    : null;
  const styleQuery = useQuery({
    ...trpc.map.style.queryOptions(
      selectedStyle === "undefined" ? skipToken : selectedStyle,
    ),
    placeholderData:
      selectedStyle === "undefined" ? undefined : keepPreviousData,
  });
  const style = styleQuery.data as AppStyle | undefined;

  const onManager = useCallback(
    (manager: MapManager) => {
      if (logEvents) {
        // @ts-expect-error private method
        const originalFire = manager._m?.fire;
        // @ts-expect-error private method
        if (manager._m!.fire !== fireWrapper) {
          // @ts-expect-error private
          manager._m!.__originalFire = originalFire.bind(manager._m!);
          // @ts-expect-error private
          manager._m!.fire = fireWrapper;
        }
      } else {
        // @ts-expect-error private
        if (manager._m?.fire === fireWrapper) {
          // @ts-expect-error private
          manager._m!.fire = manager._m!.__originalFire;
          // @ts-expect-error private
          delete manager._m!.__originalFire;
        }
      }
    },
    [logEvents],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm">
        {styleOptions && (
          <Select
            value={selectedStyle}
            onValueChange={value => setSelectedStyle(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="undefined">undefined</SelectItem>
              {styleOptions.map(style => (
                <SelectItem key={style} value={style}>
                  {style}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={terrainProp}
          onValueChange={value => setTerrainProp(value as typeof terrainProp)}>
          <SelectTrigger className="w-34">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uncontrolled">terrain: uncontrolled</SelectItem>
            <SelectItem value="true">terrain: true</SelectItem>
            <SelectItem value="false">terrain: false</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={interactive}
            onCheckedChange={checked => setInteractive(checked === true)}
          />
          interactive
        </label>
        <label className="flex items-center gap-2">
          count
          <Input
            type="number"
            min={1}
            value={count}
            onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16"
          />
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={hash}
            onCheckedChange={checked => setHash(checked === true)}
          />
          hash
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={geojsonEnabled}
            onCheckedChange={checked => setGeojsonEnabled(checked === true)}
          />
          geojson
        </label>
        {geojsonEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const raw = window.prompt("Paste GeoJSON:");
              if (!raw) return;
              try {
                setCustomGeojson(JSON.parse(raw));
              } catch {
                alert("Invalid JSON");
              }
            }}>
            Set custom GeoJSON
          </Button>
        )}
        <label className="flex items-center gap-2">
          <Checkbox
            checked={logEvents}
            onCheckedChange={checked => setLogEvents(checked === true)}
          />
          log events
        </label>
        <Button onClick={() => setResetKey(k => k + 1)}>Reset</Button>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={!hasDisabledStrictMode}
            onCheckedChange={checked => {
              if (!checked) localStorage.setItem("_disableStrictMode", "true");
              window.location.reload();
            }}
          />
          StrictMode
        </label>
      </div>

      <div
        className="grid flex-1 gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(count))}, 1fr)`,
        }}>
        {Array.from({ length: count }, (_, i) => (
          <MapView
            key={`${i}:${resetKey}`}
            style={style}
            interactive={interactive}
            hash={hash || undefined}
            terrain={
              terrainProp === "uncontrolled"
                ? undefined
                : terrainProp === "true"
            }
            geojson={
              geojsonEnabled ? customGeojson || SAMPLE_GEOJSON : undefined
            }
            onManager={onManager}
            debug={true}
          />
        ))}
      </div>
    </div>
  );
}
