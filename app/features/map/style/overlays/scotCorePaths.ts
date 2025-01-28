import type { OverlayStyle } from './OverlayStyle';

export const scotCorePathsOverlay: OverlayStyle = {
  id: 'scot_core_paths',
  name: 'Core Paths',
  details:
    'Core paths are paths, waterways or any other means of crossing land to facilitate, promote and manage the exercise of access rights under the Land Reform (Scotland) Act 2003, and are identified as such in access authority core paths plan.\n\nThere are, intentionally, no set physical standards for core paths. This means that core paths can physically be anything from a faint line across a field to a fully constructed path, track or pavement.',
  region: 'Scotland',
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/scot_core_paths.pmtiles',
    },
  },
  layers: [
    {
      id: 'line',
      type: 'line',
      source: 'default',
      'source-layer': 'default',
    },
    {
      id: 'symbol',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      filter: ['>', ['zoom'], 9],
      layout: {
        'text-field': '{path_name}',
        'text-size': 10,
      },
      paint: {
        'text-halo-width': 1.4,
        'text-halo-color': 'rgb(256,256,256)',
      },
    },
  ],
};
