import type { OverlayStyle } from './OverlayStyle';

export const scotWildLandAreasOverlay: OverlayStyle = {
  id: 'scot_wild_land_areas_2014',
  name: 'Wild Land Areas',
  details:
    'NatureScot identified 42 wild land areas following a detailed analysis in 2014 of where wildness can be found across all of Scotland’s landscapes.',
  region: 'Scotland',
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/scot_wild_land_areas_2014.pmtiles',
    },
  },
  layers: [
    {
      id: 'outline',
      type: 'line',
      source: 'default',
      'source-layer': 'default',
    },
    {
      id: 'fill',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      paint: {
        'fill-opacity': 0.2,
      },
    },
    {
      id: 'label',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      filter: ['>', ['zoom'], 7],
      layout: {
        'text-field': '{NAME}',
        'text-size': 12,
      },
      paint: {
        'text-halo-width': 1.6,
        'text-halo-color': 'rgb(256,256,256)',
      },
    },
  ],
};
