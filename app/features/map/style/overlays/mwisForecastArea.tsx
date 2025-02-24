import { OverlayStyle } from '@/features/map/style';

export const mwisForecastAreaOverlay: OverlayStyle = {
  id: 'mwis_forecast_area',
  name: 'MWIS Forecast Areas',
  region: 'Great Britain',
  details:
    'Approximately traced from the MWIS forecast areas map. All errors mine.',
  inspect: (f) => (
    <a href={f.properties.webpage} target="_blank" className="link">
      {f.properties.name} Forecast
    </a>
  ),
  sources: {
    default: {
      type: 'geojson',
      data: 'https://plantopo-storage.b-cdn.net/mwis_forecast_area_map_geojson.json',
      attribution:
        'Approximately traced from <a href="https://www.mwis.org.uk/forecast/area-map" target="_blank">MWIS</a>',
    },
  },
  // prettier-ignore
  layers: [
    {
      id: 'shape',
      type: 'fill',
      source: 'default',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.4,
      },
    },
    {
      id: 'label',
      type: 'symbol',
      source: 'default',
      minzoom: 4,
      layout: {
        'text-field': '{name}',
        'text-size': 12,
      },
      paint: {
        'text-halo-width': 1.6,
        'text-halo-color': '#ffffff',
      },
    },
  ],
};
