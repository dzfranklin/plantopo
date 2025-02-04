import type { OverlayStyle } from './OverlayStyle';
import { KVTable } from '@/components/KVTable';

export const scotCorePathsOverlay: OverlayStyle = {
  id: 'scot_core_paths',
  name: 'Core Paths',
  details:
    'Core paths are paths, waterways or any other means of crossing land to facilitate, promote and manage the exercise of access rights under the Land Reform (Scotland) Act 2003, and are identified as such in access authority core paths plan.\n\nThere are, intentionally, no set physical standards for core paths. This means that core paths can physically be anything from a faint line across a field to a fully constructed path, track or pavement.',
  region: 'Scotland',
  inspect: (f) => (
    <KVTable
      entries={[
        ['Path name', f.properties.path_name],
        ['Path code', f.properties.path_code],
        ['Section code', f.properties.sect_code],
        ['Notes', f.properties.notes],
        ['Grade', f.properties.grade],
        ['LA/NP', f.properties.local_authority],
        ['Date uploaded', f.properties.sh_date_uploaded],
        ['sh_src', f.properties.sh_src],
        ['sh_src_id', f.properties.sh_src_id],
      ]}
    />
  ),
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
