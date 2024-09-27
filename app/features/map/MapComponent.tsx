import { useCallback, useEffect, useRef, useState } from 'react';
import cls from '@/cls';
import * as ml from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoJSON } from 'geojson';
import { BaseStyle, baseStyles, defaultBaseStyle } from '@/features/map/style';
import { LayersControl } from '@/features/map/LayersControl';
import {
  CameraPosition,
  MapManager,
  MapManagerInitialView,
} from '@/features/map/MapManager';
import { fitBoundsFor } from '@/features/map/util';
import {
  InitialView,
  loadInitialView,
  storeInitialView,
} from '@/features/map/initialView';

// TODO: Add controls

export interface MapComponentProps {
  onMap?: OnMap;
  geojson?: GeoJSON;
  layers?: ml.LayerSpecification[];
  // Fit the map to the provided geojson
  fitGeoJSON?: boolean;
  // Whenever the map is fit to bounds this will be used
  fitOptions?: ml.FitBoundsOptions;
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

  const [showSkeleton, setShowSkeleton] = useState(true);

  const viewRef = useRef<CameraPosition | null>(null);

  const [baseStyle, _setBaseStyle] = useState<BaseStyle>(
    () => baseStyles[loadInitialView().baseStyle] || defaultBaseStyle,
  );
  const setBaseStyle = useCallback((value: BaseStyle) => {
    _setBaseStyle(value);
    storeInitialView({
      ...(viewRef.current || loadInitialView()),
      baseStyle: value.id,
    });
  }, []);

  // Setup

  useEffect(() => {
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
    } else {
      initialView = { at: loadInitialView() };
    }

    const map = new MapManager({
      container: mapContainerRef.current,
      initialView,
      initialBaseStyle: baseStyle,
    });

    let maybeOnMapCleanup: MaybeCleanup;
    map.m.on('load', () => {
      if (removed) return;

      setShowSkeleton(false);
      mapRef.current = map;

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

    map.m.on('move', () => {
      const { lng, lat } = map.m.getCenter();
      viewRef.current = { lng, lat, zoom: map.m.getZoom() };
    });

    let pendingSaveView: number | undefined;
    map.m.on('moveend', () => {
      if (pendingSaveView !== undefined) cancelIdleCallback(pendingSaveView);
      const { lng, lat } = map.m.getCenter();
      const view: InitialView = {
        lng,
        lat,
        zoom: map.m.getZoom(),
        baseStyle: baseStyle.id,
      };
      pendingSaveView = requestIdleCallback(() => storeInitialView(view));
    });

    return () => {
      maybeOnMapCleanup?.();
      removed = true;
      map.remove();
      mapRef.current = null;
    };
  }, [baseStyle]);

  // Sync

  useEffect(() => {
    mapRef.current?.setGeoJSON(
      props.geojson,
      propsRef.current.fitGeoJSON ?? false,
      propsRef.current.fitOptions,
    );
  }, [props.geojson]);

  useEffect(() => {
    mapRef.current?.setLayers(props.layers ?? []);
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

      <div className="absolute left-0 bottom-0">
        <div className="h-[73px] w-[73px] pl-[10px] pb-[10px]">
          <LayersControl baseStyle={baseStyle} setBaseStyle={setBaseStyle} />
        </div>
      </div>
    </div>
  );
}
