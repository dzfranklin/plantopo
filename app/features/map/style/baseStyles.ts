import { MAPTILER_KEY } from '@/env';
import { geoboundariesSource } from './geoboundariesSource';
import { z } from 'zod';
import { StyleSpecification as MLStyleSpecification } from 'maplibre-gl';
import { styleGlyphs } from '@/features/map/style/glyphs';

export type BaseStyleID = z.infer<typeof baseStyleIDSchema>;

export interface BaseStyle {
  id: BaseStyleID;
  region?: string;
  name: string;
  preview: string;
  style: string | MLStyleSpecification;
}

export const baseStyleIDSchema = z.enum([
  'topo',
  'streets',
  'satellite',
  'os',
  'usgs-imagery-topo',
  'usgs-topo',
]);

// Adding FSTopo would require mirroring https://data.fs.usda.gov/geodata/rastergateway/states-regions/quad-index.php I think, ~200GB by rough approximation

export const baseStyles: Record<BaseStyleID, BaseStyle> = {
  topo: {
    id: 'topo',
    name: 'Topo',
    preview: '/style-preview/maptiler_outdoor_v2_60x60.png',
    style:
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=' + MAPTILER_KEY,
  },
  streets: {
    id: 'streets',
    region: 'Global',
    name: 'Streets',
    preview: '/style-preview/maptiler_streets_v2_60x60.png',
    style:
      'https://api.maptiler.com/maps/streets-v2/style.json?key=' + MAPTILER_KEY,
  },
  satellite: {
    id: 'satellite',
    region: 'Global',
    name: 'Satellite',
    preview: '/style-preview/landsat_60x60.png',
    style:
      'https://api.maptiler.com/maps/satellite/style.json?key=' + MAPTILER_KEY,
  },
  os: {
    id: 'os',
    region: 'Great Britain',
    name: 'OS',
    preview: '/style-preview/os_explorer_60x60.png',
    style: {
      version: 8,
      glyphs: styleGlyphs,
      bearing: 0,
      pitch: 0,
      center: [0, 0],
      zoom: 1,
      // The empty layer and source ensure the attribution is displayed
      layers: [
        {
          id: 'adm0-outline',
          type: 'line',
          source: 'geoboundaries',
          'source-layer': 'adm0',
          filter: [
            'all',
            ['!=', ['get', 'shapeGroup'], 'GBR'],
            ['!=', ['get', 'shapeGroup'], 'IRL'],
          ],
          paint: {
            // prettier-ignore
            'line-width': ['interpolate', ['linear'], ['zoom'],
              0, 1,
              10, 2,
              15, 3,
            ],
            'line-color': 'rgb(232,232,232)',
          },
        },
        {
          id: 'os-explorer-attribution',
          type: 'line',
          source: 'os-explorer-attribution',
        },
      ],
      sources: {
        'os-explorer-attribution': {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          attribution:
            'Contains OS data &copy; Crown copyright and database rights ' +
            new Date().getFullYear(),
        },
        geoboundaries: geoboundariesSource,
      },
    },
  },
  'usgs-imagery-topo': {
    id: 'usgs-imagery-topo',
    region: 'United States of America',
    name: 'USGS Imagery',
    preview: '/style-preview/usgs_imagery_topo_60x60.png',
    style: {
      version: 8,
      glyphs: styleGlyphs,
      bearing: 0,
      pitch: 0,
      center: [0, 0],
      zoom: 1,
      sources: {
        'usgs-imagery-topo': {
          type: 'raster',
          tiles: [
            'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
          ],
          minzoom: 1,
          maxzoom: 16,
          attribution:
            '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank">USGS</a>',
        },
      },
      layers: [
        {
          id: 'usgs-imagery-topo',
          type: 'raster',
          source: 'usgs-imagery-topo',
        },
      ],
    },
  },
  'usgs-topo': {
    id: 'usgs-topo',
    region: 'United States of America',
    name: 'USGS',
    preview: '/style-preview/usgs_topo_60x60.png',
    style: {
      version: 8,
      glyphs: styleGlyphs,
      bearing: 0,
      pitch: 0,
      center: [0, 0],
      zoom: 1,
      sources: {
        'usgs-topo': {
          type: 'raster',
          tiles: [
            'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
          ],
          minzoom: 1,
          maxzoom: 16,
          attribution:
            '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank">USGS</a>',
        },
      },
      layers: [
        {
          id: 'usgs-topo',
          type: 'raster',
          source: 'usgs-topo',
        },
      ],
    },
  },
};

export const defaultBaseStyle = baseStyles['topo'];
