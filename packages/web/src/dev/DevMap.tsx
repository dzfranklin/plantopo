import { Button } from "@/components/ui/button";
import { useState } from "react";

import { MapView } from "../components/map/MapView";
import { BaseStyleSchema, type MapProps } from "../components/map/types";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";

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

export default function DevMap() {
  const [interactive, setInteractive] = useState(true);
  const [hash, setHash] = useState(true);
  const [geojsonEnabled, setGeojsonEnabled] = useState(false);
  const [customGeojson, setCustomGeojson] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [count, setCount] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [baseStyleInput, setBaseStyleInput] = useState("");
  const [baseStyle, setBaseStyle] = useState<MapProps["baseStyle"]>(undefined);
  const [baseStyleError, setBaseStyleError] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-4 py-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={interactive}
            onCheckedChange={(checked) => setInteractive(checked === true)}
          />
          interactive
        </label>
        <label className="flex items-center gap-2">
          count
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="w-16"
          />
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={hash}
            onCheckedChange={(checked) => setHash(checked === true)}
          />
          hash
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={geojsonEnabled}
            onCheckedChange={(checked) => setGeojsonEnabled(checked === true)}
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
            }}
          >
            Set custom GeoJSON
          </Button>
        )}
        <label className="flex items-center gap-2">
          baseStyle
          <Input
            className="w-64 font-mono"
            placeholder='e.g. "thunderforest" or {"type":"raster",...}'
            value={baseStyleInput}
            onChange={(e) => {
              const raw = e.target.value;
              setBaseStyleInput(raw);
              if (!raw.trim()) {
                setBaseStyleError(null);
                setBaseStyle(undefined);
                return;
              }
              let parsed: unknown;
              try {
                parsed = JSON.parse(raw);
              } catch {
                parsed = raw;
              }
              const result = BaseStyleSchema.safeParse(parsed);
              if (result.success) {
                setBaseStyleError(null);
                setBaseStyle(result.data);
              } else {
                setBaseStyleError(result.error.issues[0]?.message ?? "Invalid");
                // keep the last valid baseStyle rather than reverting to default
              }
            }}
          />
          {baseStyleError && (
            <span className="text-destructive">{baseStyleError}</span>
          )}
        </label>
        <Button onClick={() => setResetKey((k) => k + 1)}>Reset</Button>
      </div>
      <div
        className="grid flex-1 gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(count))}, 1fr)`,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <MapView
            key={`${i}:${resetKey}`}
            interactive={interactive}
            hash={hash || undefined}
            geojson={
              geojsonEnabled ? customGeojson || SAMPLE_GEOJSON : undefined
            }
            baseStyle={baseStyle}
          />
        ))}
      </div>
    </div>
  );
}
