import {
  MutableRefObject,
  RefObject,
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
import { fitBoundsFor, queryRenderedFeatures } from './util';
import { InitialView, loadInitialView, storeInitialView } from './initialView';
import deepEqual from 'deep-equal';
import { OSExplorerMapComponent } from './OSExplorerMapComponent';
import OLMap from 'ol/Map';
import { transform as olTransform } from 'ol/proj';
import { OSLogoControl } from './OSLogoControl';
import { usePortalControl } from './PortalControl';
import { Button } from '@/components/button';
import JSONView from '@/components/JSONView';
import { InspectFeaturesDialog } from './InspectFeaturesDialog';
import { MapSearchComponent, SearchResult } from './search/MapSearchComponent';
import { centroidOf } from '@/geo';
import { useDebugMode } from '@/hooks/debugMode';
import FrameRateControl from '@mapbox/mapbox-gl-framerate';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { LinearMeasureControl } from './LinearMeasureControl';
import { useSettings } from '@/features/settings/useSettings';
import { UnitSystem } from '@/features/units/format';
import { ScaleControl } from '@/features/map/ScaleControl';
import { useGeoip } from '@/features/geoip/useGeoip';
import { useHighwayGraph } from '@/features/map/snap/provider';
import * as pmtiles from 'pmtiles';

/* Features I wish I could figure out how to realistically implement:
- Map tiles that dynamically change units based on settings (including contour lines)
     - MapTiler has a tileset with contours in meters and ft: https://cloud.maptiler.com/tiles/contours-v2/
- Snap to zoom levels that map the OS explorer reprojected raster look good
 */

export type { CameraOptions } from './MapManager';

export interface MapComponentProps {
  onMap?: OnMap;
  geojson?: GeoJSON;
  layers?: ml.LayerSpecification[];
  // Fit the map to the provided geojson
  fitGeoJSON?: boolean;
  // Whenever the map is fit to bounds this will be used
  fitOptions?: ml.FitBoundsOptions;
  initialBounds?: ml.LngLatBoundsLike;
  maxBounds?: ml.LngLatBoundsLike;
  initialCamera?: InitialCamera;
  initialBaseStyle?: BaseStyleID;
  minimal?: boolean;
  interactive?: boolean;
  debugMode?: boolean;
}

export type MaybeCleanup = (() => void) | void;
export type OnMap = (map: ml.Map) => MaybeCleanup;
export type InitialCamera = Pick<CameraOptions, 'lng' | 'lat' | 'zoom'> &
  Partial<CameraOptions>;

(MapboxDraw.constants.classes.CONTROL_BASE as any) = 'maplibregl-ctrl';
(MapboxDraw.constants.classes.CONTROL_PREFIX as any) = 'maplibregl-ctrl-';
(MapboxDraw.constants.classes.CONTROL_GROUP as any) = 'maplibregl-ctrl-group';

ml.addProtocol(
  'pmtiles',
  new pmtiles.Protocol({
    metadata: true, // required to show attribution
  }).tile,
);

export default function MapComponentImpl(props: MapComponentProps) {
  // Inputs

  const propsRef = useRef(props);
  propsRef.current = props;

  const interactive = props.interactive ?? true;

  const defaultDebugMode = useDebugMode();
  const debugMode = props.debugMode ?? defaultDebugMode;
  const debugModeRef = useRef(debugMode);
  debugModeRef.current = debugMode;

  const { units } = useSettings();
  const unitsRef = useRef<UnitSystem | undefined>(units);
  unitsRef.current = units;

  const highwayGraph = useHighwayGraph();

  const measureControlRef = useRef<LinearMeasureControl | null>(null);
  if (!measureControlRef.current) {
    measureControlRef.current = new LinearMeasureControl({
      units,
      highwayGraph,
    });
  }

  const scaleControlRef = useRef<ScaleControl | null>(null);
  if (!scaleControlRef.current) {
    scaleControlRef.current = new ScaleControl({ units });
  }

  const geoip = useGeoip();
  const geoipRef = useRef(geoip);
  geoipRef.current = geoip;

  // State

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapManager | null>(null);
  const explorerMapRef = useRef<OLMap | null>(null);

  const [showSkeleton, setShowSkeleton] = useState(true);

  const tilesLoadingIndicator = useRef<HTMLDivElement>(null);
  const explorerTilesLoaded = useRef(true);
  const viewRef = useRef<CameraOptions | null>(null);

  const [baseStyle, _setBaseStyle] = useState<BaseStyle>(
    () =>
      baseStyles[props.initialBaseStyle ?? defaultBaseStyle.id] ||
      defaultBaseStyle,
  );
  const setBaseStyle = useCallback((value: BaseStyle) => {
    _setBaseStyle(value);
    storeInitialView({
      ...(viewRef.current || loadInitialView(geoipRef.current)),
      baseStyle: value.id,
    });
  }, []);

  const [activeOverlays, setActiveOverlays] = useState<OverlayStyle[]>([]);
  const activeOverlaysRef = useRef<OverlayStyle[]>(activeOverlays);
  activeOverlaysRef.current = activeOverlays;

  const [inspectFeatures, setInspectFeatures] = useState<
    ml.MapGeoJSONFeature[]
  >([]);

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  // Controls

  const [layersPortal, layersControl] = usePortalControl(
    <div className="hidden @[300px]:block h-[63px] w-[63px] m-[10px] pointer-events-auto">
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

  const [searchPortal, searchControl] = usePortalControl(
    <div
      className={cls(
        'hidden @[300px]:block',
        '@[300px]:w-[250px] @[350px]:w-[300px] @[400px]:w-[350px] @[450px]:w-[400px] @[500px]:w-[450px]',
        'p-[10px] pointer-events-auto',
      )}
    >
      <MapSearchComponent
        setSelected={setSearchResult}
        getBias={() => {
          if (!mapRef.current) return;
          return {
            point: mapRef.current.getCenter(),
            zoom: mapRef.current.m.getZoom(),
          };
        }}
      />
    </div>,
    'search-control',
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
    } else if (propsRef.current.initialBounds) {
      initialView = {
        fit: propsRef.current.initialBounds,
        options: propsRef.current.fitOptions,
      };
    } else {
      initialView = { at: loadInitialView(geoipRef.current) };
    }

    const map = new MapManager({
      container: mapContainerRef.current,
      initialView,
      baseStyle: baseStyle,
      interactive,
    });
    explorerMapRef.current && syncExplorerMap(map.m, explorerMapRef.current);

    if (propsRef.current.maxBounds) {
      map.m.setMaxBounds(propsRef.current.maxBounds);
    }

    map.m.getCanvas().style.outline = 'none';

    // Controls

    if (interactive) {
      map.m.addControl(layersControl, 'bottom-left');
      map.m.addControl(searchControl, 'top-left');
      map.m.addControl(new ml.NavigationControl());
      measureControlRef.current && map.m.addControl(measureControlRef.current);
    }

    if (!props.minimal) {
      scaleControlRef.current && map.m.addControl(scaleControlRef.current);
    }

    if (baseStyle.id === 'os-explorer') {
      map.m.addControl(new OSLogoControl());
    }

    if (debugModeRef.current) {
      map.m.addControl(new FrameRateControl(), 'bottom-left');
    }

    // Events

    let maybeOnMapCleanup: MaybeCleanup;
    map.m.once('style.load', () => {
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

    map.m.on('data', () => {
      updateTilesLoading(tilesLoadingIndicator, map.m, explorerTilesLoaded);
    });

    map.m.on('click', (evt) => {
      if (evt.originalEvent.altKey && debugModeRef.current) {
        evt.preventDefault();
        const query = queryRenderedFeatures(map.m, evt.point, 2);
        setInspectFeatures(query);
      }
    });

    return () => {
      maybeOnMapCleanup?.();
      removed = true;
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle, layersControl, searchControl, interactive, props.minimal]);

  // Sync

  const onExplorerMap = useCallback((oMap: OLMap) => {
    explorerMapRef.current = oMap;
    console.log('connected explorer map');

    if (viewRef.current) {
      setExplorerMapView(oMap, viewRef.current);
    }

    oMap.on('loadstart', () => {
      explorerTilesLoaded.current = false;
      updateTilesLoading(
        tilesLoadingIndicator,
        mapRef.current?.m ?? null,
        explorerTilesLoaded,
      );
    });

    oMap.on('loadend', () => {
      explorerTilesLoaded.current = true;
      updateTilesLoading(
        tilesLoadingIndicator,
        mapRef.current?.m ?? null,
        explorerTilesLoaded,
      );
    });

    return () => {
      console.log('disconnected explorer map');
      explorerMapRef.current = null;
      explorerTilesLoaded.current = true;
      updateTilesLoading(
        tilesLoadingIndicator,
        mapRef.current?.m ?? null,
        explorerTilesLoaded,
      );
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

  const searchResultMarker = useRef<ml.Marker | undefined>(undefined);
  useEffect(() => {
    if (!mapRef.current) return;
    if (searchResultMarker.current) {
      searchResultMarker.current.remove();
    }
    if (searchResult) {
      const center = centroidOf(searchResult.geometry);
      searchResultMarker.current = new ml.Marker({ color: '#ea4236' })
        .setLngLat(center)
        .addTo(mapRef.current.m);
      mapRef.current.flyIntoView({ center, minZoom: 10 });
    }
    return () => {
      searchResultMarker.current?.remove();
      searchResultMarker.current = undefined;
    };
  }, [searchResult]);

  useEffect(() => {
    measureControlRef.current?.setUnits(units);
    scaleControlRef.current?.setUnits(units);
  }, [units]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.m.setMaxBounds(props.maxBounds);
    }
  }, [props.maxBounds]);

  return (
    <div
      className={cls(
        '@container relative m-0 w-full max-w-full h-full max-h-full',
        showSkeleton && 'bg-gray-300 animate-pulse',
      )}
    >
      <div className="absolute inset-0 pointer-events-none">
        {baseStyle.id === 'os-explorer' && (
          <OSExplorerMapComponent
            onMap={onExplorerMap}
            // Because we integrate attribution with the others via a dummy source and layer in the style
            hideAttribution={true}
          />
        )}
      </div>

      <div
        ref={mapContainerRef}
        className="w-full h-full max-h-full max-w-full"
      />

      <div
        ref={tilesLoadingIndicator}
        className={cls(
          'absolute left-0 top-0 right-0 transition-opacity pointer-events-none',
        )}
        style={{ opacity: '0' }}
      >
        <div className="h-1 w-full bg-blue-200 overflow-hidden">
          <div className="animate-[progress_1.5s_infinite_linear] w-full h-full bg-blue-500 origin-left-right"></div>
        </div>
      </div>

      {interactive && layersPortal}
      {interactive && searchPortal}

      <InspectFeaturesDialog
        show={inspectFeatures.length > 0}
        onClose={() => setInspectFeatures([])}
        features={inspectFeatures}
      />
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

  const oCenter = olTransform([cam.lng, cam.lat], 'EPSG:4326', 'EPSG:3857');
  const oZoom = cam.zoom + 1;
  const oRotation = (-cam.bearing * Math.PI) / 180;

  const oView = oMap.getView();
  oView.setZoom(oZoom);
  oView.setRotation(oRotation);
  oView.setCenter(oCenter);

  oMap.renderSync();
}

function updateTilesLoading(
  indicator: RefObject<HTMLDivElement>,
  mMap: ml.Map | null,
  explorerIsLoaded: MutableRefObject<boolean>,
) {
  if (!indicator.current) return;

  let isLoading = false;
  if (mMap && !mMap.areTilesLoaded()) {
    isLoading = true;
  }
  if (!explorerIsLoaded.current) {
    isLoading = true;
  }

  const prev = !(indicator.current.style.opacity === '0');
  if (isLoading != prev) {
    if (isLoading) {
      indicator.current.style.opacity = '100';
    } else {
      indicator.current.style.opacity = '0';
    }
  }
}

function MapDebugMenu({
  mapRef,
}: {
  mapRef: MutableRefObject<MapManager | null>;
}) {
  const [values, setValues] = useState<Record<string, unknown> | undefined>();
  return (
    <div>
      <div className="space-x-2">
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

        <Button
          onClick={() => {
            const mm = mapRef.current;
            (window as any).mm = mm;
            (window as any).m = mm?.m;
            console.info('window.mm = ', mm);
            console.info('window.m = ', mm?.m);
          }}
        >
          Assign to global
        </Button>
      </div>

      <JSONView data={values} />
    </div>
  );
}
