import * as mlStyle from '@maplibre/maplibre-gl-style-spec';
import {
  USER_FEATURES_DATA_ID,
  USER_FEATURE_LAYER_SPECS,
} from './base/featuresLayer';
import { Layer, LayerData, LayerSource } from './layers/types';

const ATTRIBUTION = {
  os: `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`,
  mapbox:
    '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
};

const glLayerId = (sourceLayerId: string, specId: string) =>
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

const RESOLVED_IMAGE_PROPS = {
  background: [['paint', 'background-pattern']],
  fill: [['paint', 'fill-pattern']],
  line: [['paint', 'line-pattern']],
  symbol: [['layout', 'icon-image']],
  'fill-extrusion': [['paint', 'fill-extrusion-pattern']],
};

const TERRAIN_SOURCE_ID = 'terrain';

export const computeLayers = (
  layerSources: { [id: number]: LayerSource },
  layers: Layer[],
): mlStyle.LayerSpecification[] => {
  const out = layers.flatMap((layer, idx) => {
    const source = layerSources[layer.sourceId];
    return source.layerSpecs.map((spec) => {
      const out: mlStyle.LayerSpecification = {
        ...spec,
        id: glLayerId(layer.sourceId, spec.id),
      };

      // This can't be opacity = layer.opacity || ... because 0 is falsy
      let opacity = layer.opacity ?? source.defaultOpacity ?? 1;
      if (idx === 0) opacity = 1;

      const paint = spec.paint ? { ...spec.paint } : {};
      const layout = spec.layout ? { ...spec.layout } : {};

      for (const prop of OPACITY_PROPS[spec.type]) {
        paint[prop] = (paint[prop] || 1) * opacity;
      }

      for (const [ty, prop] of RESOLVED_IMAGE_PROPS[spec.type] ?? []) {
        const map = ty === 'paint' ? paint : layout;
        if (map[prop] !== undefined) {
          map[prop] = ['concat', source.id + ':', map[prop]];
        }
      }

      out.paint = paint;
      out.layout = layout;
      return out;
    });
  });

  for (const l of USER_FEATURE_LAYER_SPECS) {
    out.push(l);
  }

  return out;
};

export const computeSources = (layerDatas: {
  [id: string]: LayerData;
}): mlStyle.StyleSpecification['sources'] => {
  const out = Object.fromEntries(
    Object.values(layerDatas).map((s) => {
      const spec = { ...s.spec };
      if (s.attribution) spec['attribution'] = ATTRIBUTION[s.attribution];
      return [s.id, spec];
    }),
  );

  out[USER_FEATURES_DATA_ID] = {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  };

  return out;
};

export const computeTerrain = (): mlStyle.TerrainSpecification => ({
  source: TERRAIN_SOURCE_ID,
});

// TODO: Figure out how to combine glyph and sprite. Maybe a special loader?
