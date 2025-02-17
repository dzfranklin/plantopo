import { OverlayStyle } from './OverlayStyle';
import { KVTable } from '@/components/KVTable';
import { API_ENDPOINT } from '@/env';

export const sepaStationsOverlay: OverlayStyle = {
  id: 'sepa_water_level_stations',
  name: 'SEPA Water Level Stations',
  sources: {
    default: {
      type: 'geojson',
      data: API_ENDPOINT + 'sepa-stations',
      attribution:
        '<a href="https://timeseriesdoc.sepa.org.uk/" target="_blank">SEPA</a>',
    },
  },
  inspect: (f) => (
    <KVTable
      entries={[
        ['Name', f.properties.name],
        ['Catchment', f.properties.catchment_name],
        ['Parameters', f.properties.parameter_long_names],
        [
          null,
          <a
            key="levels"
            href={f.properties.levels_webpage}
            target="_blank"
            className="link"
          >
            Levels
          </a>,
        ],
      ]}
    />
  ),
  // prettier-ignore
  layers: [
    {
      id: 'symbol',
      type: 'symbol',
      source: 'default',
      filter: ['get', 'has_stage'],
      layout: {
        'icon-image': '/sprites/river_stage_station@2x.png',
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.1, 10, 1],
      },
      paint: {
        'icon-color': '#3b82f6',
        'icon-halo-width': 2,
        'icon-halo-color': '#ffffff',
      },
    },
  ],
};
