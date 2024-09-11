import type {
  DataDrivenPropertyValueSpecification,
  LayerSpecification,
  SourceSpecification,
} from 'mapbox-gl';

export const geophotosSource: SourceSpecification = {
  type: 'vector',
  url: 'https://pmtiles.plantopo.com/geophotos.json',
};

const pointSizeFragment: DataDrivenPropertyValueSpecification<number> = [
  'coalesce',
  ['get', 'sqrt_point_count'],
  1,
];

// prettier-ignore
export const geophotosLayers: LayerSpecification[] = [
  {
    id: 'geophoto',
    type: 'symbol',
    source: 'geophotos',
    'source-layer': 'default',
    layout: {
      'icon-image': 'pmarker',
      'icon-size': [
        'interpolate',
        ['exponential', 2],
        ['zoom'],
        2, ['max', ['/', pointSizeFragment, 3000], 0.2],
        7, ['max', ['/', pointSizeFragment, 100], 0.4],
        18, ['max', ['/', pointSizeFragment, 4], 0.8],
      ],
      'icon-padding': 0,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': [
        'case',
        ['coalesce', ['feature-state', 'selected'], false],
        '#7c3aed',
        '#3b82f6',
      ],
    },
  },
];
