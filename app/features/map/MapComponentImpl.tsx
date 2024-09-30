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
import {
  MapSearchComponent,
  SearchResult,
} from '@/features/map/search/MapSearchComponent';
import { centroidOf } from '@/geo';

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
  interactive?: boolean;
}

export type MaybeCleanup = (() => void) | void;
export type OnMap = (map: ml.Map) => MaybeCleanup;

export default function MapComponentImpl(props: MapComponentProps) {
  // Inputs

  const propsRef = useRef(props);
  propsRef.current = props;

  const interactive = props.interactive ?? true;

  // State

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapManager | null>(null);
  const explorerMapRef = useRef<OLMap | null>(null);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [areMLTilesLoaded, setAreMLTilesLoaded] = useState(true);
  const [areOLTilesLoaded, setAreOLTilesLoaded] = useState(true);
  const areTilesLoaded = areMLTilesLoaded && areOLTilesLoaded;

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

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  // Controls

  const [layersPortal, layersControl] = usePortalControl(
    <div className="hidden @[300px]:block h-[73px] w-[73px] pb-[10px] pl-[10px] pointer-events-auto">
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
    } else {
      initialView = { at: loadInitialView() };
    }

    const map = new MapManager({
      container: mapContainerRef.current,
      initialView,
      baseStyle: baseStyle,
      interactive,
    });
    explorerMapRef.current && syncExplorerMap(map.m, explorerMapRef.current);

    // Controls

    if (interactive) {
      map.m.addControl(layersControl, 'bottom-left');
      map.m.addControl(searchControl, 'top-left');
      map.m.addControl(new ml.NavigationControl());
    }

    if (baseStyle.id === 'os-explorer') {
      map.m.addControl(new OSLogoControl());
    }

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

    map.m.on('data', () => setAreMLTilesLoaded(map.m.areTilesLoaded()));

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
  }, [baseStyle, layersControl, interactive, searchControl]);

  // Sync

  const onExplorerMap = useCallback((oMap: OLMap) => {
    explorerMapRef.current = oMap;
    console.log('connected explorer map');

    if (viewRef.current) {
      setExplorerMapView(oMap, viewRef.current);
    }

    oMap.on('loadstart', () => {
      setAreOLTilesLoaded(false);
    });
    oMap.on('loadend', () => {
      setAreOLTilesLoaded(true);
    });

    return () => {
      console.log('disconnected explorer map');
      explorerMapRef.current = null;
      setAreOLTilesLoaded(true);
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
        className={cls(
          'absolute left-0 top-0 right-0 transition-opacity pointer-events-none',
          areTilesLoaded ? 'opacity-0' : 'opacity-100',
        )}
      >
        <TilesLoadingIndicator />
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

  const oCenter = olTransform([cam.lng, cam.lat], 'EPSG:4326', 'EPSG:3857');
  const oZoom = cam.zoom + 1;
  const oRotation = (-cam.bearing * Math.PI) / 180;

  const oView = oMap.getView();
  oView.setZoom(oZoom);
  oView.setRotation(oRotation);
  oView.setCenter(oCenter);

  oMap.renderSync();
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
