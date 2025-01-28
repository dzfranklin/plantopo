import { OverlayStyle } from '@/features/map/style';

export const geophotosOverlay: OverlayStyle = {
  id: 'geophotos_coverage',
  name: 'Geophotos coverage',
  details:
    'Geophotos is a project I am working on that will show photos of natural areas around the world. This shows the areas covered by my database.',
  sources: {
    default: {
      type: 'vector',
      url: 'https://pmtiles.plantopo.com/geophotos.json',
      attribution: '',
    },
  },
  // prettier-ignore
  layers: [
    {
      id: 'symbol',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      layout: {
        'icon-image': '/sprites/marker@2x.png.sdf',
        'icon-size': [
          'interpolate',
          ['exponential', 2],
          ['zoom'],
          2, ['max', ['/', ['coalesce', ['get', 'sqrt_point_count'], 1], 3000], 0.2],
          7, ['max', ['/', ['coalesce', ['get', 'sqrt_point_count'], 1], 100], 0.4],
          18, ['max', ['/', ['coalesce', ['get', 'sqrt_point_count'], 1], 4], 0.8],
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
  ],
};
