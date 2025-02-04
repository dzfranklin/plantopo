import { KVTable } from '@/components/KVTable';
import type { OverlayStyle } from './OverlayStyle';

export const caledonianPinewoodInventoryOverlay: OverlayStyle = {
  id: 'caledonian_pinewood_inventory',
  name: 'Caledonian Pinewood Inventory',
  details:
    'Inventoried by Scottish Forestry based on the 1959 book <i>The Native Pinewoods of Scotland</i> by Steven and Carlisle. Some of the pinewood fragments which they thought were too small to form discreet pinewood habitats have also been considered. In all cases the balance of probability suggests that they are genuinely native, that is, descended from one generation to another by natural seeding.',
  region: 'Scotland',
  inspect: (f) => (
    <KVTable
      entries={[
        ['PINEID', f.properties.PINEID],
        ['PINENAME', f.properties.PINENAME],
        ['FEATDESC', f.properties.FEATDESC],
        ['NGR', f.properties.NGR],
        ['BIOCHEM', f.properties.BIOCHEM],
        ['COREAREA', f.properties.COREAREA],
        ['REGENAREA', f.properties.REGENAREA],
        ['BUFFERAREA', f.properties.BUFFERAREA],
        ['TOTALAREA', f.properties.TOTALAREA],
      ]}
    />
  ),
  sources: {
    default: {
      type: 'vector',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/caledonian_pinewood_inventory.pmtiles',
    },
  },
  layers: [
    {
      id: 'inventory-fill',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      // prettier-ignore
      filter: ['all',
        ['!=', ['get', 'FEATDESC'], 'Cal Pine Regeneration Zone'],
        ['!=', ['get', 'FEATDESC'], 'Cal Pine Buffer Zone'],
        ['!=', ['get', 'FEATDESC'], 'Cal Pine Planted Area'],
      ],
      paint: {
        'fill-color': 'rgba(9,173,9,0.5)',
      },
    },
    {
      id: 'planted-fill',
      type: 'fill',
      source: 'default',
      'source-layer': 'default',
      filter: ['==', ['get', 'FEATDESC'], 'Cal Pine Planted Area'],
      paint: {
        'fill-color': 'rgba(79,115,79,0.5)',
      },
    },
    {
      id: 'symbol',
      type: 'symbol',
      source: 'default',
      'source-layer': 'default',
      filter: ['>', ['zoom'], 9],
      layout: {
        // prettier-ignore
        'text-field': ['case',
          ['==', ['get', 'FEATDESC'], 'Cal Pine Planted Area'],
          ['concat', ['get', 'PINENAME'], ' (planted)'],
          ['get', 'PINENAME'],
        ],
        'text-size': 10,
      },
      paint: {
        'text-halo-width': 1.4,
        'text-halo-color': 'rgb(256,256,256)',
      },
    },
  ],
};
