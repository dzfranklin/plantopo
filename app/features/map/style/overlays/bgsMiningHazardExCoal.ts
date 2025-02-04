import type { OverlayStyle } from './OverlayStyle';

export const bgsMiningHazardExCoalOverlay: OverlayStyle = {
  id: 'bgs_mining_hazard_ex_coal',
  name: 'Mining Hazard',
  details:
    'The BGS mining hazard (not including coal) 1 km hex grid dataset provides a generalised overview of the likelihood for mining to have occurred. It provides a national-scale summary of the presence of mining and an indication of the level of hazard associated with old workings. Classes Low and NA are omitted for clarity.',
  region: 'Great Britain',
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/bgs_mining_hazard_ex_coal.pmtiles',
    },
  },
  layers: [
    {
      id: 'poly',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      filter: [
        'all',
        ['!=', ['get', 'Class'], 'NA'],
        ['!=', ['get', 'Class'], 'Low'],
      ],
      paint: {
        // prettier-ignore
        'fill-color': ['case',
          ['==', ['get', 'Class'], 'Significant'], 'rgba(255,0,0,0.3)',
          ['==', ['get', 'Class'], 'Moderate'], 'rgba(255,255,0,0.3)',
          'rgba(0,0,0,0.2)',
        ],
      },
    },
  ],
};
