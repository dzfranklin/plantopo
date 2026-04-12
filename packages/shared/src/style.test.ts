import type ml from "maplibre-gl";
import { describe, expect, it } from "vitest";

import { insertLayers } from "./style.js";

describe("insertLayers", () => {
  it("inserts at end if slot not found", () => {
    const layers: ml.LayerSpecification[] = [
      { id: "a", type: "line", source: "src" },
      { id: "b", type: "line", source: "src" },
    ];
    const newLayers: ml.LayerSpecification[] = [
      { id: "x", type: "line", source: "src" },
      { id: "y", type: "line", source: "src" },
    ];
    const result = insertLayers(layers, "middle", newLayers);
    expect(result).toEqual([
      { id: "a", type: "line", source: "src" },
      { id: "b", type: "line", source: "src" },
      { id: "x", type: "line", source: "src" },
      { id: "y", type: "line", source: "src" },
    ]);
  });

  it("inserts right before slot placeholder", () => {
    const layers: ml.LayerSpecification[] = [
      { id: "a", type: "line", source: "src" },
      {
        id: "plantopo:slot-middle",
        type: "background",
        layout: { visibility: "none" },
      },
      { id: "b", type: "line", source: "src" },
    ];
    const newLayers: ml.LayerSpecification[] = [
      { id: "x", type: "line", source: "src" },
      { id: "y", type: "line", source: "src" },
    ];
    const result = insertLayers(layers, "middle", newLayers);
    expect(result).toEqual([
      { id: "a", type: "line", source: "src" },
      { id: "x", type: "line", source: "src" },
      { id: "y", type: "line", source: "src" },
      {
        id: "plantopo:slot-middle",
        type: "background",
        layout: { visibility: "none" },
      },
      { id: "b", type: "line", source: "src" },
    ]);
  });
});
