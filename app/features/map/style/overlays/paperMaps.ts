import type { OverlayStyle } from './OverlayStyle';

export const paperMapsOverlay: OverlayStyle = {
  id: 'paper-maps',
  name: 'Paper Maps',
  details:
    'My work-in-progress database of paper maps. Contribute at <a href="https://github.com/dzfranklin/paper-maps" target="_blank">github.com/dzfranklin/paper-maps</a>.',
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/paper-maps/paper_maps.pmtiles',
    },
  },
  layers: [
    {
      id: 'outline',
      type: 'line',
      source: 'default',
      'source-layer': 'default',
      minzoom: 4,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#424242'],
        'line-width': 1.5,
        'line-opacity': 0.8,
      },
    },
    {
      id: 'fill',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      minzoom: 5,
      layout: {},
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], '#424242'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.3,
          0.1,
        ],
      },
    },
    {
      id: 'label',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      layout: {
        // prettier-ignore
        'icon-offset': ['step', ['zoom'],
          ['literal', [0, 0]],
          7, ['literal', [0, -0.2]]],
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': ['step', ['zoom'], false, 6, true],
        'icon-anchor': ['step', ['zoom'], 'center', 7, 'bottom'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 9, 0.5],

        'text-offset': [0, 0.2],
        // prettier-ignore
        'text-field': [
          'step', ['zoom'],
          '',
          7, ['get', 'short_title'],
          9, ['get', 'title'],
        ],
        'text-allow-overlap': true,
        'text-size': 14,
        'text-anchor': 'top',
      },
      paint: {
        'text-color': ['coalesce', ['get', 'color'], '#212121'],
        'text-halo-width': 1.4,
        'text-halo-color': '#fafafa',
      },
    },
  ],
};
