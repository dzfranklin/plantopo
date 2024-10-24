import { OS_KEY } from '@/env';
import { olProj27700 } from '@/features/map/crs';
import XYZSource from 'ol/source/XYZ';
import { TileGrid } from 'ol/tilegrid';

const osLeisureURL =
  'https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key=' +
  OS_KEY;

const osLeisureConfig = {
  resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
  origin: [-238375.0, 1376256.0],
};

const osExtent = [-238375.0, 0.0, 900000.0, 1376256.0];

const osAttribution =
  'Contains OS data &copy; Crown copyright and database rights ' +
  new Date().getFullYear();

export const viewConfig = {
  osLandranger: {
    minZoom: 7,
    maxZoom: 7,
    projection: olProj27700,
    resolutions: osLeisureConfig.resolutions,
    tileLayerConfig: {
      source: new XYZSource({
        url: osLeisureURL,
        projection: olProj27700,
        tileGrid: new TileGrid({
          ...osLeisureConfig,
          resolutions: osLeisureConfig.resolutions.slice(0, 8),
        }),
        transition: 0,
        crossOrigin: 'anonymous',
        attributions: [osAttribution],
        attributionsCollapsible: false,
      }),
      maxZoom: 7,
      extent: osExtent,
    },
    showOSAttribution: true,
  },
  osExplorer: {
    minZoom: 8,
    maxZoom: 9,
    projection: olProj27700,
    resolutions: osLeisureConfig.resolutions,
    tileLayerConfig: {
      source: new XYZSource({
        url: osLeisureURL,
        projection: olProj27700,
        tileGrid: new TileGrid({
          ...osLeisureConfig,
          resolutions: osLeisureConfig.resolutions,
        }),
        transition: 0,
        crossOrigin: 'anonymous',
        attributions: [osAttribution],
        attributionsCollapsible: false,
      }),
      maxZoom: 9,
      extent: osExtent,
    },
    showOSAttribution: true,
  },
};

export type ViewID = keyof typeof viewConfig;
