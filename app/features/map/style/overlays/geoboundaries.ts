import type { OverlayStyle } from './OverlayStyle';
import { geoboundariesSource } from '@/features/map/style/geoboundariesSource';

export const geoboundariesOverlay: OverlayStyle = {
  id: 'geoboundaries',
  name: 'Countries',
  sources: {
    default: geoboundariesSource,
  },
  layers: [
    {
      id: 'adm0-outline',
      type: 'line',
      source: 'default',
      'source-layer': 'adm0',
      paint: {
        // prettier-ignore
        'line-width': ['interpolate', ['linear'], ['zoom'],
          0, 1,
          10, 2,
          15, 3,
        ],
        'line-color': 'rgba(168,168,168,0.6)',
      },
    },
    {
      id: 'adm0-label',
      type: 'symbol',
      source: 'default',
      'source-layer': 'adm0_label',
      minzoom: 5,
      layout: {
        'text-field': '{shapeName}',
        'text-font': ['Roboto Bold', 'Noto Sans Bold'],
        'text-line-height': 1.2,
        'text-max-width': 8.25,
        'text-padding': 0,
        // prettier-ignore
        'text-size': ['interpolate', ['linear'], ['zoom'],
          5, 10,
          8, 20,
        ],
      },
      paint: {
        'text-color': '#423e3e',
        'text-halo-color': '#f7f7f7',
        'text-halo-blur': 1.6,
        'text-halo-width': 1.4,
      },
    },
  ],
};
