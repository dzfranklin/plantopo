import { MAPTILER_KEY } from '@/env';
import { z } from 'zod';
import * as ml from 'maplibre-gl';

export const baseStyleIDSchema = z.enum([
  'topo',
  'streets',
  'satellite',
  'os-explorer',
  'usgs-imagery-topo',
  'usgs-topo',
]);

export type BaseStyleID = z.infer<typeof baseStyleIDSchema>;

export interface BaseStyle {
  id: BaseStyleID;
  country: string;
  name: string;
  preview: string;
  style: string | ml.StyleSpecification;
}

export interface OverlayStyle {
  id: string;
  name: string;
  sources?: Record<string, ml.SourceSpecification>;
  layers?: ml.LayerSpecification[];
}

const defaultGlyphs =
  'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=' + MAPTILER_KEY;

// Adding FSTopo would require mirroring https://data.fs.usda.gov/geodata/rastergateway/states-regions/quad-index.php I think, ~200GB by rough approximation

export const baseStyles: Record<BaseStyleID, BaseStyle> = {
  topo: {
    id: 'topo',
    country: 'Global',
    name: 'Topo',
    preview: '/style-preview/maptiler_outdoor_v2_60x60.png',
    style:
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=' + MAPTILER_KEY,
  },
  streets: {
    id: 'streets',
    country: 'Global',
    name: 'Streets',
    preview: '/style-preview/maptiler_streets_v2_60x60.png',
    style:
      'https://api.maptiler.com/maps/streets-v2/style.json?key=' + MAPTILER_KEY,
  },
  satellite: {
    id: 'satellite',
    country: 'Global',
    name: 'Satellite',
    preview: '/style-preview/landsat_60x60.png',
    style:
      'https://api.maptiler.com/maps/satellite/style.json?key=' + MAPTILER_KEY,
  },
  'os-explorer': {
    id: 'os-explorer',
    country: 'Great Britain',
    name: 'Explorer',
    preview: '/style-preview/os_explorer_60x60.png',
    style: {
      version: 8,
      glyphs: defaultGlyphs,
      bearing: 0,
      pitch: 0,
      center: [0, 0],
      zoom: 1,
      // The empty layer and source ensure the attribution is displayed
      layers: [
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
      },
    },
  },
  'usgs-imagery-topo': {
    id: 'usgs-imagery-topo',
    country: 'United States of America',
    name: 'USGS Imagery',
    preview: '/style-preview/usgs_imagery_topo_60x60.png',
    style: {
      version: 8,
      glyphs: defaultGlyphs,
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
    country: 'United States of America',
    name: 'USGS',
    preview: '/style-preview/usgs_topo_60x60.png',
    style: {
      version: 8,
      glyphs: defaultGlyphs,
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

const overlayStyleList: OverlayStyle[] = [
  {
    id: 'geophotos_coverage',
    name: 'Geophotos coverage',
    sources: {
      default: {
        type: 'vector',
        url: 'https://pmtiles.plantopo.com/geophotos.json',
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
          'icon-image': '/marker@2x.png',
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
  },
  {
    id: 'scot_core_paths',
    name: 'Core Paths (Scotland)',
    sources: {
      default: {
        type: 'vector',
        url: 'https://pmtiles.plantopo.com/scot_core_paths.json',
        attribution:
          '<a href="https://data.spatialhub.scot/dataset/core_paths-is" target="_blank">Improvement Service</a> under <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank">OGL</a>',
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
  },
  {
    id: 'scot_wild_land_areas_2014',
    name: 'Wild Land Areas 2014 (Scotland)',
    sources: {
      default: {
        type: 'vector',
        url: 'https://pmtiles.plantopo.com/scot_wild_land_areas_2014.json',
        attribution:
          '<a href="https://www.nature.scot/professional-advice/landscape/landscape-policy-and-guidance/landscape-policy-wild-land" target="_blank">NatureScot</a>',
      },
    },
    layers: [
      {
        id: 'outline',
        type: 'line',
        source: 'default',
        'source-layer': 'default',
      },
      {
        id: 'fill',
        type: 'fill',
        source: 'default',
        'source-layer': 'default',
        paint: {
          'fill-opacity': 0.2,
        },
      },
      {
        id: 'label',
        type: 'symbol',
        source: 'default',
        'source-layer': 'default',
        filter: ['>', ['zoom'], 7],
        layout: {
          'text-field': '{NAME}',
          'text-size': 12,
        },
        paint: {
          'text-halo-width': 1.6,
          'text-halo-color': 'rgb(256,256,256)',
        },
      },
    ],
  },
  {
    id: 'caledonian_pinewood_inventory',
    name: 'Caledonian Pinewood Inventory (Scotland)',
    sources: {
      default: {
        type: 'vector',
        url: 'https://pmtiles.plantopo.com/caledonian_pinewood_inventory.json',
        attribution:
          '<a href="https://www.data.gov.uk/dataset/9fe00904-da11-44f7-97c3-f4e617e34ec7/caledonian-pinewood-inventory" target="_blank">Scottish Forestry</a>',
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
  },
  {
    id: 'bgs_mining_hazard_ex_coal',
    name: 'British Geological Survey Mining Hazard (not including coal)',
    sources: {
      default: {
        type: 'vector',
        url: 'https://pmtiles.plantopo.com/bgs_mining_hazard_ex_coal.json',
        attribution:
          '<a href="https://osdatahub.os.uk/downloads/open/GB-Hex-1km-Mining-Haz" target="_blank">British Geological Survey</a>',
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
  },
];

export const overlayStyles: Record<string, OverlayStyle> =
  overlayStyleList.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
