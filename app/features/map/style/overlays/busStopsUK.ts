import type { OverlayStyle } from './OverlayStyle';

export const busStopsUKOverlay: OverlayStyle = {
  id: 'bus_stops_uk',
  name: 'Bus Stops',
  details: 'Bus stops in England, Scotland, and Wales',
  region: 'Great Britain',
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/bus_stops_uk.pmtiles',
    },
  },
  layers: [
    {
      id: 'symbol',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      layout: {
        'icon-image': '/sprites/bus@2x.png.sdf',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 10, 1],
      },
      paint: {
        'icon-color': 'rgb(30 64 175)',
        'icon-halo-blur': 0.5,
        'icon-halo-color': 'rgb(255 255 255)',
        'icon-halo-width': 3,
      },
    },
  ],
};
