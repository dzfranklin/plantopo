import * as ml from 'maplibre-gl';
import { OS_KEY } from '@/env';
import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj.js';
import { register as registerOLProj4 } from 'ol/proj/proj4.js';
import ReprojTile from 'ol/reproj/Tile';
import { TileGrid } from 'ol/tilegrid';
import TileState from 'ol/TileState';
import TileImageSource from 'ol/source/TileImage';

// See <https://github.com/wipfli/maplibre-raster-preprocess/blob/main/index.html>

type TileCoord = [number, number, number]; // z,x,y

const errorThreshold = 0.25;
const renderEdges = false; // for debugging

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 ' +
    '+x_0=400000 +y_0=-100000 +ellps=airy ' +
    '+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 ' +
    '+units=m +no_defs',
);
registerOLProj4(proj4);

const proj27700 = getProjection('EPSG:27700')!;
proj27700.setExtent([0, 0, 700000, 1300000]);

const proj3857 = getProjection('EPSG:3857')!;

const tileSize = 256;

// TODO: extent, attribution
const explorerStyle: ml.StyleSpecification = {
  version: 8,
  name: 'OS Explorer',
  sources: {
    explorer: {
      type: 'raster',
      tiles: ['os-explorer://tile?z={z}&x={x}&y={y}'],
      tileSize,
      minzoom: 0,
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'explorer',
      type: 'raster',
      source: 'explorer',
    },
  ],
};

let pendingRequests = 0;

ml.addProtocol('os-explorer', async (params, abortController) => {
  const url = new URL(params.url);
  const path = url.pathname.replace(/^\/\//, '');

  if (path === 'style.json') {
    return { data: explorerStyle };
  } else if (path === 'tile') {
    const z = parseInt(url.searchParams.get('z')!);
    const x = parseInt(url.searchParams.get('x')!);
    const y = parseInt(url.searchParams.get('y')!);
    if (isNaN(z) || isNaN(x) || isNaN(y)) throw new Error('bad params');

    pendingRequests++;
    const data = await reprojectTile([z, x, y], abortController);
    pendingRequests--;
    console.log('pendingRequests', pendingRequests);
    return { data };
  } else {
    throw new Error('not implemented: ' + params.url);
  }
});

const tileImageSource = new TileImageSource({
  url:
    'https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key=' +
    OS_KEY,
  projection: 'EPSG:27700',
  wrapX: false,
  crossOrigin: '',
  tileGrid: new TileGrid({
    resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
    origin: [-238375.0, 1376256.0],
  }),
  reprojectionErrorThreshold: errorThreshold,
});
tileImageSource.setRenderReprojectionEdges(renderEdges);

function reprojectTile(
  coord: TileCoord,
  abortController: AbortController,
): Promise<ArrayBuffer> {
  console.log(`reprojectTile: requesting ${coord.join('/')}`);
  return new Promise((resolve, reject) => {
    const tile = tileImageSource.getTile(
      coord[0],
      coord[1],
      coord[2],
      1,
      proj3857,
    ) as ReprojTile;

    abortController.signal.addEventListener('abort', () => {
      console.log(`aborting ${coord.join('/')}`);
      tile.dispose();
    });

    tile.addEventListener('change', () => {
      switch (tile.getState()) {
        case TileState.LOADED: {
          const canvas = tile.getImage();
          canvas.toBlob((blob) => blob!.arrayBuffer().then(resolve));
          console.log(`reprojectTile: reprojected ${coord.join('/')}`);
          return;
        }
        case TileState.ERROR: {
          reject(new Error('openlayers: reprojection tile in error state'));
          return;
        }
      }
    });

    tile.load();
  });
}
