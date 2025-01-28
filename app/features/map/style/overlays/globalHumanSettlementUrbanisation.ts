import type { OverlayStyle } from './OverlayStyle';

export const globalHumanSettlementUrbanisationOverlay: OverlayStyle = {
  id: 'global_human_settlement_urbanisation',
  name: 'Degree of Urbanisation',
  details:
    'Copernicus EMS derived the degree of urbanisation from built-up surfaces detected in 2018 satellite imagery and extrapolation from 2005-2014 population censuses. Very low and low density rural grid cells are omitted from this layer for visual clarity.',
  sources: {
    default: {
      type: 'raster',
      url: 'pmtiles://https://plantopo-storage.b-cdn.net/global_human_settlement_urbanisation_1km_colors.pmtiles',
      tileSize: 512,
    },
  },
  layers: [
    {
      id: 'raster',
      type: 'raster',
      source: 'default',
    },
  ],
};
