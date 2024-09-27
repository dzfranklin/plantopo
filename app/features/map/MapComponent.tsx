import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import cls from '@/cls';
import * as ml from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoJSON } from 'geojson';
import {
  BaseStyle,
  BaseStyleID,
  baseStyles,
  defaultBaseStyle,
  OverlayStyle,
} from './style';
import { LayersControl } from './LayersControl';
import { CameraOptions, MapManager, MapManagerInitialView } from './MapManager';
import { fitBoundsFor } from './util';
import {
  InitialView,
  loadInitialView,
  storeInitialView,
} from '@/features/map/initialView';
import deepEqual from 'deep-equal';
import { OSExplorerMapComponent } from './OSExplorerMapComponent';
import OLMap from 'ol/Map';
import { transform as olTransform } from 'ol/proj';
import { OSLogoControl } from './OSLogoControl';
import { usePortalControl } from './PortalControl';
import { Button } from '@/components/button';
import JSONView from '@/components/JSONView';
import {
  InspectFeature,
  InspectFeaturesDialog,
} from '@/features/map/InspectFeaturesDialog';

// TODO: Add controls
// TODO: settings-aware
// TODO: snap to zoom for raster basestyle?
// TODO: if stored baseStyle is a limited region and you load a map outside the region you should use the default

export type { CameraOptions } from './MapManager';

export interface MapComponentProps {
  onMap?: OnMap;
  geojson?: GeoJSON;
  layers?: ml.LayerSpecification[];
  // Fit the map to the provided geojson
  fitGeoJSON?: boolean;
  // Whenever the map is fit to bounds this will be used
  fitOptions?: ml.FitBoundsOptions;
  initialCamera?: Pick<CameraOptions, 'lng' | 'lat' | 'zoom'> &
    Partial<CameraOptions>;
  initialBaseStyle?: BaseStyleID;
}

export type MaybeCleanup = (() => void) | undefined;
export type OnMap = (map: ml.Map) => MaybeCleanup;

export function MapComponent(props: MapComponentProps) {
  // Inputs

  const propsRef = useRef(props);
  propsRef.current = props;

  // State

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapManager | null>(null);
  const explorerMapRef = useRef<OLMap | null>(null);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [areTilesLoaded, setAreTilesLoaded] = useState(false);

  const viewRef = useRef<CameraOptions | null>(null);

  const [baseStyle, _setBaseStyle] = useState<BaseStyle>(
    () =>
      baseStyles[props.initialBaseStyle ?? loadInitialView().baseStyle] ||
      defaultBaseStyle,
  );
  const setBaseStyle = useCallback((value: BaseStyle) => {
    _setBaseStyle(value);
    storeInitialView({
      ...(viewRef.current || loadInitialView()),
      baseStyle: value.id,
    });
  }, []);

  const [activeOverlays, setActiveOverlays] = useState<OverlayStyle[]>([]);
  const activeOverlaysRef = useRef<OverlayStyle[]>(activeOverlays);
  activeOverlaysRef.current = activeOverlays;

  const [inspectFeatures, setInspectFeatures] = useState<InspectFeature[]>([]);

  // Controls

  const [layersPortal, layersControl] = usePortalControl(
    <div className="h-[73px] w-[73px] pl-[10px] pb-[10px] pointer-events-auto">
      <LayersControl
        activeBase={baseStyle}
        setActiveBase={setBaseStyle}
        activeOverlays={activeOverlays}
        setActiveOverlays={setActiveOverlays}
        debugMenu={<MapDebugMenu mapRef={mapRef} />}
      />
    </div>,
    'layers-control',
  );

  // Setup

  useLayoutEffect(() => {
    if (!mapContainerRef.current) return;
    let removed = false;

    let initialView: MapManagerInitialView | undefined;
    if (viewRef.current) {
      initialView = { at: viewRef.current };
    } else if (propsRef.current.geojson && propsRef.current.fitGeoJSON) {
      initialView = {
        fit: fitBoundsFor(propsRef.current.geojson),
        options: propsRef.current.fitOptions,
      };
    } else if (propsRef.current.initialCamera) {
      initialView = {
        at: { bearing: 0, pitch: 0, ...propsRef.current.initialCamera },
      };
    } else {
      initialView = { at: loadInitialView() };
    }

    const map = new MapManager({
      container: mapContainerRef.current,
      initialView,
      baseStyle: baseStyle,
    });
    explorerMapRef.current && syncExplorerMap(map.m, explorerMapRef.current);

    // Controls

    map.m.addControl(layersControl, 'bottom-left');

    if (baseStyle.id === 'os-explorer') {
      map.m.addControl(new OSLogoControl());
    }

    map.m.addControl(new ml.NavigationControl());

    // Events

    let maybeOnMapCleanup: MaybeCleanup;
    map.m.on('load', () => {
      if (removed) return;

      console.log('initialized map');

      map.m.resize();

      setShowSkeleton(false);
      mapRef.current = map;

      viewRef.current = cameraPosition(map.m);

      explorerMapRef.current && syncExplorerMap(map.m, explorerMapRef.current);

      map.setOverlays(activeOverlaysRef.current);

      if (propsRef.current.geojson) {
        map.setGeoJSON(
          propsRef.current.geojson,
          propsRef.current.fitGeoJSON ?? false,
          propsRef.current.fitOptions,
        );
      }

      map.setLayers(propsRef.current.layers ?? []);

      maybeOnMapCleanup = propsRef.current.onMap?.(map.m);
    });

    map.m.on('render', () => {
      explorerMapRef.current && syncExplorerMap(map.m, explorerMapRef.current);
    });

    map.m.on('move', () => {
      viewRef.current = cameraPosition(map.m);
    });

    let pendingSaveView: number | undefined;
    map.m.on('moveend', () => {
      if (pendingSaveView !== undefined) cancelIdleCallback(pendingSaveView);
      const currentCamera = cameraPosition(map.m);
      const view: InitialView = { ...currentCamera, baseStyle: baseStyle.id };
      pendingSaveView = requestIdleCallback(() => storeInitialView(view));
    });

    map.m.on('data', () => setAreTilesLoaded(map.m.areTilesLoaded()));

    map.m.on('click', (evt) => {
      if (evt.originalEvent.altKey) {
        evt.preventDefault();
        const slop = 2;
        const query = map.m.queryRenderedFeatures([
          [evt.point.x - slop, evt.point.y - slop],
          [evt.point.x + slop, evt.point.y + slop],
        ]);
        setInspectFeatures(
          query.map((f) => ({
            rawSource: f.source,
            rawSourceLayer: f.sourceLayer,
            properties: f.properties,
            layer: f.layer,
          })),
        );
      }
    });

    return () => {
      maybeOnMapCleanup?.();
      removed = true;
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle, layersControl]);

  // Sync

  const onExplorerMap = useCallback((oMap: OLMap) => {
    explorerMapRef.current = oMap;

    if (viewRef.current) setExplorerMapView(oMap, viewRef.current);

    return () => {
      explorerMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setOverlays(activeOverlays);
  }, [activeOverlays]);

  const prevGeoJSON = useRef<GeoJSON | undefined>(undefined);
  useEffect(() => {
    if (deepEqual(prevGeoJSON.current, props.geojson)) return;
    mapRef.current?.setGeoJSON(
      props.geojson,
      propsRef.current.fitGeoJSON ?? false,
      propsRef.current.fitOptions,
    );
    prevGeoJSON.current = props.geojson;
  }, [props.geojson]);

  const prevLayers = useRef<ml.LayerSpecification[] | undefined>(undefined);
  useEffect(() => {
    if (deepEqual(prevLayers.current, props.layers)) return;
    mapRef.current?.setLayers(props.layers ?? []);
    prevLayers.current = props.layers;
  }, [props.layers]);

  return (
    <div
      className={cls(
        'relative m-0 w-full max-w-full h-full max-h-full',
        showSkeleton && 'bg-gray-300 animate-pulse',
      )}
    >
      <div
        ref={mapContainerRef}
        className="w-full h-full max-h-full max-w-full"
      />

      <div className="absolute inset-0 -z-40 pointer-events-none">
        {baseStyle.id === 'os-explorer' && (
          <OSExplorerMapComponent
            onMap={onExplorerMap}
            // Because we integrate attribution with the others via a dummy source and layer in the style
            hideAttribution={true}
          />
        )}
      </div>

      <div
        className={cls(
          'absolute left-0 top-0 right-0 transition-opacity pointer-events-none',
          areTilesLoaded ? 'opacity-0' : 'opacity-100',
        )}
      >
        <TilesLoadingIndicator />
      </div>

      {layersPortal}

      <InspectFeaturesDialog
        show={inspectFeatures.length > 0}
        onClose={() => setInspectFeatures([])}
        features={inspectFeatures}
      />
    </div>
  );
}

function TilesLoadingIndicator() {
  return (
    <div className="h-1 w-full bg-blue-200 overflow-hidden">
      <div className="animate-[progress_1.5s_infinite_linear] w-full h-full bg-blue-500 origin-left-right"></div>
    </div>
  );
}

function cameraPosition(map: ml.Map): CameraOptions {
  const { lng, lat } = map.getCenter();
  return {
    lng,
    lat,
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    zoom: map.getZoom(),
  };
}

function syncExplorerMap(mMap: ml.Map, oMap: OLMap) {
  if (mMap.getPitch() !== 0) mMap.setPitch(0);
  setExplorerMapView(oMap, cameraPosition(mMap));
}

function setExplorerMapView(oMap: OLMap, cam: CameraOptions) {
  // The inverse of <https://openlayers.org/en/latest/examples/mapbox-layer.html>
  const oView = oMap.getView();
  oView.setZoom(cam.zoom + 1);
  oView.setRotation((-cam.bearing * Math.PI) / 180);
  oView.setCenter(olTransform([cam.lng, cam.lat], 'EPSG:4326', 'EPSG:3857'));
}

export function MapDebugMenu({
  mapRef,
}: {
  mapRef: MutableRefObject<MapManager | null>;
}) {
  const [values, setValues] = useState<Record<string, unknown> | undefined>();
  return (
    <div>
      <Button
        onClick={() => {
          if (!mapRef.current) {
            setValues(undefined);
            return;
          }
          const map = mapRef.current.m;
          setValues({
            camera: cameraPosition(map),
            manager: mapRef.current.debugValues(),
          });
        }}
      >
        Read values
      </Button>

      <JSONView data={values} />
    </div>
  );
}
