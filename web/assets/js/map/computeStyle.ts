import { LayerData, Layer, LayerSource } from './mapSlice';
import * as ml from 'maplibre-gl';

const ATTRIBUTION = {
  os: `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`,
  mapbox:
    '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
};

const glLayerId = (sourceLayerId: number, specId: string) =>
  `${sourceLayerId}-${specId}`;

const OPACITY_PROPS = {
  background: ['background-opacity'],
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  symbol: [], // Skipping "icon-opacity", "text-opacity"
  raster: ['raster-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  heatmap: ['heatmap-opacity'],
  hillshade: ['hillshade-exaggeration'],
};

const OPACITY_CUTOFF = 0.95;
const TERRAIN_SOURCE_ID = 'terrain';

type UpdatePaint = (id: string, prop: string, value: number) => void;
type DataSources = { [id: string]: LayerData };
type LayerSources = { [id: number]: LayerSource };
type Change3d = string | false | undefined;

export default function computeStyle(
  dataSources: DataSources,
  layerSources: LayerSources,
  is3d: boolean,
  layers: Layer[],
  prevIs3d: boolean,
  prevLayers: Layer[] | undefined,
  updateFull: (style: ml.StyleSpecification, change3d: Change3d) => void,
  updatePaint: UpdatePaint,
) {
  const full = () => {
    const style = computeFullStyle(dataSources, layerSources, is3d, layers);

    let change3d: Change3d;
    if (is3d != prevIs3d) {
      change3d = is3d ? TERRAIN_SOURCE_ID : false;
    }

    updateFull(style, change3d);
    window._dbg.computeStyleStats.fullUpdates += 1;
  };

  if (is3d != prevIs3d || !prevLayers || layers.length !== prevLayers.length) {
    full();
    return;
  }

  for (let i = 0; i < layers.length; i++) {
    if (prevLayers[i].sourceId !== layers[i].sourceId) {
      full();
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
  is3d: boolean,
  layers: Layer[],
): ml.StyleSpecification {
  const style: Partial<ml.StyleSpecification> = {
    version: 8,
  };

  const activeLayerSources = layers.map(
    (layer) => layerSources[layer.sourceId],
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

  if (is3d) {
    activeDataSourceIds.add(TERRAIN_SOURCE_ID);
  }

  const activeDataSources = Array.from(activeDataSourceIds.keys()).map((id) => {
    const s = dataSources[id];
    const spec = { ...s.spec };
    if (s.attribution) spec['attribution'] = ATTRIBUTION[s.attribution];
    return [s.id, spec];
  });
  style.sources = Object.fromEntries(activeDataSources);

  style.layers = layers.flatMap((layer) => {
    const source = layerSources[layer.sourceId];
    return source.layerSpecs.map((spec) => {
      const out = {
        ...spec,
        id: glLayerId(layer.sourceId, spec.id),
        paint: spec.paint ? { ...spec.paint } : {},
      };

      const opacity = layer.opacity || source.defaultOpacity || 1;
      if (opacity < OPACITY_CUTOFF) {
        for (const prop of OPACITY_PROPS[spec.type]) {
          out.paint[prop] = (out.paint[prop] || 1) * opacity;
        }
      }

      return out as ml.LayerSpecification;
    });
  });

  return style as ml.StyleSpecification;
}

function computeLayerStyleUpdate(
  layerSources: LayerSources,
  layer: Layer,
  updatePaint: UpdatePaint,
) {
  const source = layerSources[layer.sourceId];
  const opacity = layer.opacity || source.defaultOpacity || 1;
  if (opacity < OPACITY_CUTOFF) {
    for (const spec of source.layerSpecs) {
      const glId = glLayerId(layer.sourceId, spec.id);
      for (const prop of OPACITY_PROPS[spec.type]) {
        const value = (spec.paint?.[prop] || 1) * opacity;
        updatePaint(glId, prop, value);
      }
    }
  }
}
