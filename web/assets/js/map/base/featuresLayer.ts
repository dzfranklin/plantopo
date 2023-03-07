import * as mlStyle from '@maplibre/maplibre-gl-style-spec';

export const USER_FEATURES_DATA_ID = '_userFeatures';

// prettier-ignore
export const USER_FEATURE_LAYER_SPECS: mlStyle.LayerSpecification[] = [
  {
    id: '_userPoint',
    source: USER_FEATURES_DATA_ID,
    type: 'symbol',
    filter: ['get', 'visible'],
    layout: {
      // Icon layout
      'icon-anchor': ['coalesce', ['get', 'style:icon-anchor'], 'center'],
      'icon-image': ['get', 'style:icon-image'],
      'icon-offset': ['coalesce', ['get', 'style:icon-offset'], ['literal', [0, 0]]],
      'icon-size': ['coalesce', ['get', 'style:icon-size'], 1],

      // Text layout
      'text-anchor': ['coalesce', ['get', 'style:text-anchor'], 'top'],
      'text-font': ['match', ['get', 'style:text-font'],
        'Open Sans Semibold', ['literal', ['Open Sans Semibold', 'sans-serif']],
        ['literal', ['sans-serif']],
      ],
      'text-justify': ['coalesce', ['get', 'style:text-justify'], 'center'],
      'text-letter-spacing': ['coalesce', ['get', 'style:text-letter-spacing'], 0],
      'text-max-width': ['coalesce', ['get', 'style:text-max-width'], 10],
      'text-offset': ['coalesce', ['get', 'style:text-offset'], ['literal', [0, 0.8]]],
      'text-rotate': ['coalesce', ['get', 'style:text-rotate'], 0],
      'text-size': ['coalesce', ['get', 'style:text-size'], 16],

      // Base
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
      'text-field': ['get', 'name'],
      'text-ignore-placement': true,
    },
    paint: {
      // Icon paint
      'icon-color': ['coalesce', ['get', 'style:icon-color'], '#5e5e5e'],
      'icon-halo-blur': ['coalesce', ['get', 'style:icon-halo-blur'], 0],
      'icon-halo-color': ['coalesce', ['get', 'style:icon-halo-color'], '#FFF'],
      'icon-halo-width': ['coalesce', ['get', 'style:icon-halo-width'], 2],
      'icon-opacity': ['coalesce', ['get', 'style:icon-opacity'], 1],
      // Text paint
      'text-color': ['coalesce', ['get', 'style:text-color'], '#363636'],
      'text-halo-blur': ['coalesce', ['get', 'style:text-halo-blur'], 0],
      'text-halo-color': ['coalesce', ['get', 'style:text-halo-color'], '#FFF'],
      'text-halo-width': ['coalesce', ['get', 'style:text-halo-width'], 2],
      'text-opacity': ['coalesce', ['get', 'style:text-opacity'], 1],
    },
  },
];
