import { MAPTILER_KEY } from '@/env';
import { z } from 'zod';
import * as ml from 'maplibre-gl';

export const baseStyleIDSchema = z.enum([
  'topo',
  'streets',
  'satellite',
  'os',
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
  variables?: Record<string, StyleVariableSpec>;
  sources?: Record<string, ml.SourceSpecification>;
  layers?: ml.LayerSpecification[];
}

export interface StyleVariables {
  overlay?: Record<string, Record<string, string>>;
}

export interface StyleVariablesSpec {
  overlay?: Record<string, Record<string, StyleVariableSpec>>;
}

export type StyleVariableSpec = SelectStyleVariable;

export interface SelectStyleVariable {
  type: 'select';
  label: string;
  defaultValue: string;
  options: { name: string; value: string }[];
}

const defaultGlyphs =
  'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=' + MAPTILER_KEY;

// Adding FSTopo would require mirroring https://data.fs.usda.gov/geodata/rastergateway/states-regions/quad-index.php I think, ~200GB by rough approximation

const geoboundariesSource: ml.SourceSpecification = {
  type: 'vector',
  url: 'pmtiles://https://plantopo-storage.b-cdn.net/geoboundaries.pmtiles',
};

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
  os: {
    id: 'os',
    country: 'Great Britain',
    name: 'OS',
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
          'icon-image': '/sprites/marker@2x.png.sdf',
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
  },
  {
    id: 'scot_wild_land_areas_2014',
    name: 'Wild Land Areas 2014 (Scotland)',
    sources: {
      default: {
        type: 'vector',
        url: 'pmtiles://https://plantopo-storage.b-cdn.net/scot_wild_land_areas_2014.pmtiles',
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
  },
  {
    id: 'bgs_mining_hazard_ex_coal',
    name: 'British Geological Survey Mining Hazard (not including coal)',
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
  },
  {
    id: 'geoboundaries',
    name: 'Countries',
    sources: {
      default: geoboundariesSource,
    },
    layers: [
      {
        id: 'adm0-outline',
        type: 'line',
        source: 'default',
        'source-layer': 'adm0',
        paint: {
          // prettier-ignore
          'line-width': ['interpolate', ['linear'], ['zoom'],
            0, 1,
            10, 2,
            15, 3,
          ],
          'line-color': '#a8a8a8',
        },
      },
    ],
  },
  {
    id: 'global_human_settlement_urbanisation',
    name: 'Degree of Urbanisation (1km resolution)',
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
  },
  {
    id: 'icon_eu_h_snow',
    name: 'EU Snow Depth Forecast (ICON-EU, ~7km resolution)',
    variables: {
      HOUR: {
        type: 'select',
        label: 'Time',
        defaultValue: '000h',
        options: [
          { name: 'Today', value: '000h' },
          { name: 'Tomorrow', value: '024h' },
          { name: '+2d', value: '048h' },
          { name: '+3d', value: '072h' },
          { name: '+4d', value: '096h' },
          { name: '+5d', value: '120h' },
        ],
      },
    },
    sources: {
      default: {
        type: 'raster',
        url: 'https://plantopo-storage.b-cdn.net/weather-maps/icon_eu_h_snow/__HOUR__/source.json',
      },
    },
    layers: [
      {
        id: 'raster',
        type: 'raster',
        source: 'default',
      },
    ],
  },
  {
    id: 'paper-maps',
    name: 'Paper Maps',
    sources: {
      default: {
        type: 'vector',
        url: 'pmtiles://https://plantopo-storage.b-cdn.net/paper-maps/paper_maps.pmtiles',
      },
    },
    layers: [
      {
        id: 'outline',
        type: 'line',
        source: 'default',
        'source-layer': 'default',
        minzoom: 4,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#424242'],
          'line-width': 1.5,
          'line-opacity': 0.8,
        },
      },
      {
        id: 'fill',
        type: 'fill',
        source: 'default',
        'source-layer': 'default',
        minzoom: 5,
        layout: {},
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#424242'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.3,
            0.1,
          ],
        },
      },
      {
        id: 'label',
        type: 'symbol',
        source: 'default',
        'source-layer': 'default',
        layout: {
          // prettier-ignore
          'icon-offset': ['step', ['zoom'],
            ['literal', [0, 0]],
            7, ['literal', [0, -0.2]]],
          'icon-image': ['get', 'icon'],
          'icon-allow-overlap': ['step', ['zoom'], false, 6, true],
          'icon-anchor': ['step', ['zoom'], 'center', 7, 'bottom'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 9, 0.5],

          'text-offset': [0, 0.2],
          // prettier-ignore
          'text-field': [
            'step', ['zoom'],
            '',
            7, ['get', 'short_title'],
            9, ['get', 'title'],
          ],
          'text-allow-overlap': true,
          'text-size': 14,
          'text-anchor': 'top',
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#212121'],
          'text-halo-width': 1.4,
          'text-halo-color': '#fafafa',
        },
      },
    ],
  },
];

export const overlayStyles: Record<string, OverlayStyle> =
  overlayStyleList.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});

export const defaultStyleVariables: StyleVariables = {
  overlay: {},
};
for (const overlayStyle of Object.values(overlayStyles)) {
  if (
    overlayStyle.variables &&
    Object.keys(overlayStyle.variables).length > 0
  ) {
    defaultStyleVariables.overlay![overlayStyle.id] = Object.fromEntries(
      Object.entries(overlayStyle.variables).map(([id, spec]) => [
        id,
        spec.defaultValue,
      ]),
    );
  }
}
