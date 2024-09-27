import { useEffect, useRef } from 'react';
import { OS_KEY } from '@/env';
import proj4 from 'proj4';
import { register as registerOLProj4 } from 'ol/proj/proj4';
import { get as getProjection, transform } from 'ol/proj';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { TileGrid } from 'ol/tilegrid';
import XYZSource from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
import 'ol/ol.css';
import { Coordinate as OLCoord } from 'ol/coordinate';
import AttributionControl from 'ol/control/Attribution';
import { Control } from 'ol/Control';

const reprojectionErrorThreshold = 0.2;
const debugMode = false;

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

const tileGrid = new TileGrid({
  resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
  origin: [-238375.0, 1376256.0],
});

export function OSExplorerMapComponent({
  center,
  zoom,
  onMap,
  hideAttribution,
}: {
  center?: [number, number];
  zoom?: number;
  onMap?: (map: OLMap) => (() => void) | void;
  // When integrated with MapComponent the attribution text is integrated with the other attributions
  hideAttribution?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  let centerLng: number | undefined;
  let centerLat: number | undefined;
  if (center !== undefined) {
    centerLng = center[0];
    centerLat = center[1];
  }
  useEffect(() => {
    if (!containerRef.current) return;

    let center: OLCoord | undefined;
    if (centerLng !== undefined && centerLat !== undefined) {
      center = transform([centerLng, centerLat], 'EPSG:4326', 'EPSG:3857');
    } else {
      center = [0, 0];
    }

    const source = new XYZSource({
      url:
        'https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key=' +
        OS_KEY,
      projection: 'EPSG:27700',
      tileGrid,
      reprojectionErrorThreshold,
      attributions: [
        'Contains OS data &copy; Crown copyright and database rights ' +
          new Date().getFullYear(),
      ],
    });
    source.setRenderReprojectionEdges(debugMode);

    const controls: Control[] = [];
    if (!hideAttribution) {
      controls.push(new AttributionControl({ collapsed: false }));
    }

    const map = new OLMap({
      controls,
      interactions: [],
      layers: [
        new TileLayer({
          source,
        }),
      ],
      target: containerRef.current,
      view: new View({
        projection: 'EPSG:3857',
        center,
        zoom: zoom ?? 0,
      }),
    });

    const maybeCleanupOnMap = onMap?.(map);

    return () => {
      maybeCleanupOnMap?.();
      map.dispose();
    };
  }, [centerLng, centerLat, zoom, onMap, hideAttribution]);

  return (
    <div className="relative w-full max-w-full h-full max-h-full">
      <div ref={containerRef} className="w-full max-w-full h-full max-h-full" />
      {!hideAttribution && (
        <img
          className="absolute right-[8px] bottom-[8px]"
          width="90"
          height="24"
          src="/os-logo-maps.svg"
          alt="Ordnance Survey maps logo"
        />
      )}
    </div>
  );
}
