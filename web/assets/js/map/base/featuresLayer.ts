import * as mlStyle from '@maplibre/maplibre-gl-style-spec';

export const USER_FEATURES_DATA_ID = '_userFeatures';

export const USER_FEATURE_LAYER_SPECS: mlStyle.LayerSpecification[] = [
  {
    id: '_userPoint',
    source: USER_FEATURES_DATA_ID,
    type: 'symbol',
    filter: ['get', 'visible'],
    layout: {
      // Text
      'text-font': ['Open Sans Semibold'],
      'text-field': ['get', 'name'],
    },
    paint: {},
  },
];
