import { ViewDataSource, ViewLayer, ViewLayerSource } from "./mapSlice";
import * as ml from "maplibre-gl";

const ATTRIBUTION = {
  os: `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`,
  mapbox: `© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>`,
};

const glLayerId = (sourceLayerId: number, specId: string) =>
  `${sourceLayerId}-${specId}`;

const OPACITY_PROPS = {
  background: ["background-opacity"],
  fill: ["fill-opacity"],
  line: ["line-opacity"],
  symbol: [], // Skipping "icon-opacity", "text-opacity"
  raster: ["raster-opacity"],
  circle: ["circle-opacity", "circle-stroke-opacity"],
  "fill-extrusion": ["fill-extrusion-opacity"],
  heatmap: ["heatmap-opacity"],
  hillshade: ["hillshade-exaggeration"],
};

const OPACITY_CUTOFF = 0.95;

type UpdatePaint = (id: string, prop: string, value: number) => void;
type DataSources = { [id: string]: ViewDataSource };
type LayerSources = { [id: number]: ViewLayerSource };

export default function computeStyle(
  dataSources: DataSources,
  layerSources: LayerSources,
  layers: ViewLayer[],
  prevLayers: ViewLayer[] | undefined,
  updateFull: (style: ml.StyleSpecification) => void,
  updatePaint: UpdatePaint
) {
  if (!prevLayers || layers.length !== prevLayers.length) {
    updateFull(computeFullStyle(dataSources, layerSources, layers));
    window._dbg.computeStyleStats.fullUpdates += 1;
    return;
  }

  for (let i = 0; i < layers.length; i++) {
    if (prevLayers[i].sourceId !== layers[i].sourceId) {
      updateFull(computeFullStyle(dataSources, layerSources, layers));
      window._dbg.computeStyleStats.fullUpdates += 1;
      return;
    }
  }

  let didUpdatePaint = false;
  for (let i = 1; i < layers.length; i++) {
    if (prevLayers[i].opacity !== layers[i].opacity) {
      computeLayerStyleUpdate(layerSources, layers[i], updatePaint);
      didUpdatePaint = true;
    }
  }

  if (didUpdatePaint) window._dbg.computeStyleStats.paintOnlyUpdates += 1;
}

export function computeFullStyle(
  dataSources: DataSources,
  layerSources: LayerSources,
  layers: ViewLayer[]
): ml.StyleSpecification {
  const style: Partial<ml.StyleSpecification> = {
    version: 8,
  };

  const activeLayerSources = layers.map(
    (layer) => layerSources[layer.sourceId]
  );
  const glyphs = activeLayerSources.find((s) => s.glyphs)?.glyphs;
  const sprite = activeLayerSources.find((s) => s.sprite)?.sprite;
  if (glyphs) style.glyphs = glyphs;
  if (sprite) style.sprite = sprite;

  const activeDataSourceIds = new Set<string>();
  for (const layerSource of activeLayerSources) {
    for (const id of layerSource.dependencies) {
      activeDataSourceIds.add(id);
    }
  }

  const activeDataSources = Array.from(activeDataSourceIds.keys()).map((id) => {
    let s = dataSources[id];
    let spec = { ...s.spec } as any;
    if (s.attribution) spec.attribution = ATTRIBUTION[s.attribution];
    return [s.id, spec];
  });
  style.sources = Object.fromEntries(activeDataSources);

  style.layers = layers.flatMap((layer) =>
    layerSources[layer.sourceId].layerSpecs.map((spec) => {
      const out = {
        ...spec,
        id: glLayerId(layer.sourceId, spec.id),
      };

      if (layer.opacity < OPACITY_CUTOFF) {
        if (!out.paint) out.paint = {};
        for (const prop of OPACITY_PROPS[spec.type]) {
          out.paint[prop] = (out.paint[prop] || 1) * layer.opacity;
        }
      }

      return out;
    })
  );

  return style as ml.StyleSpecification;
}

export function computeLayerStyleUpdate(
  layerSources: LayerSources,
  layer: ViewLayer,
  updatePaint: UpdatePaint
) {
  if (layer.opacity > 0.95) {
    return;
  }

  const source = layerSources[layer.sourceId];
  for (const spec of source.layerSpecs) {
    const glId = glLayerId(layer.sourceId, spec.id);
    for (const prop of OPACITY_PROPS[spec.type]) {
      const value = (spec.paint[prop] || 1) * layer.opacity;
      updatePaint(glId, prop, value);
    }
  }
}
