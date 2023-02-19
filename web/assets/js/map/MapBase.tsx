import { useRef, useEffect } from "react";
import * as ml from "maplibre-gl";
import deepEqual from "react-fast-compare";
import { useAppDispatch, useAppSelector, useAppStore } from "./hooks";
import {
  flyTo,
  mapClick,
  reportViewAt,
  selectGeolocation,
  selectGLStyle,
  selectTokens,
  selectViewAt,
  ViewAt,
} from "./mapSlice";
import "../userSettings";
import { startListening } from "./listener";
import "../map";

export interface Props {
  isLoading: (_: boolean) => void;
}

const FLY_TO_SPEED = 2.8;

export default function MapBase(props: Props) {
  const store = useAppStore();
  const dispatch = useAppDispatch();

  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ml.Map>();

  useEffect(() => {
    if (!mapRef.current) {
      const state = store.getState();
      const tokens = selectTokens(state);
      const viewAt = selectViewAt(state);

      const map = new ml.Map({
        container: nodeRef.current!,
        style: {
          version: 8,
          sources: {},
          layers: [],
        },
        center: viewAt.center,
        pitch: viewAt.pitch,
        bearing: viewAt.bearing,
        zoom: viewAt.zoom,
        keyboard: false,
        transformRequest: (urlS) => {
          const url = new URL(urlS);
          const params = url.searchParams;

          if (url.host === "api.os.uk") {
            params.set("srs", "3857");
            params.set("key", tokens.os);
          } else if (url.host === "api.mapbox.com") {
            params.set("access_token", tokens.mapbox);
          }

          return {
            url: url.toString(),
          };
        },
      });
      mapRef.current = map;
      window._dbg.mapGL = map;

      startListening({
        actionCreator: flyTo,
        effect: async ({ payload }, l) => {
          const map = mapRef.current!;
          const current = selectViewAt(store.getState());
          const { options, to } = payload;

          let center = to.center || current.center;
          let zoom = to.zoom || current.zoom;
          let pitch = to.pitch || current.pitch;
          let bearing = to.bearing || current.bearing;

          if (
            options.ignoreIfCenterVisible &&
            map.getBounds().contains(center)
          ) {
            return;
          }

          let opts: ml.FlyToOptions = {
            center,
            zoom,
            pitch,
            bearing,
            speed: FLY_TO_SPEED,
          };

          if (window.userSettings.disableAnimation) {
            opts.duration = 0;
          }

          map.flyTo(opts);
        },
      });

      // Note that move is fired during any transition
      map.on("move", () => {
        const state = store.getState();

        const center = map.getCenter();
        const at: ViewAt = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        };
        const prevAt = selectViewAt(state);
        if (!deepEqual(at, prevAt)) {
          dispatch(reportViewAt(at));
        }
      });

      map.on("click", (evt) => {
        const TARGET_WIDTH_PX = 20;
        const point = evt.point;
        const features = map
          .queryRenderedFeatures([
            [point.x - TARGET_WIDTH_PX / 2, point.y - TARGET_WIDTH_PX / 2],
            [point.x + TARGET_WIDTH_PX / 2, point.y + TARGET_WIDTH_PX / 2],
          ])
          .map((f) => ({
            layer: f.layer.id,
            properties: f.properties,
          }));

        dispatch(
          mapClick({
            geo: [evt.lngLat.lng, evt.lngLat.lat],
            screen: [evt.point.x, evt.point.y],
            features,
          })
        );
      });

      for (const evt of ["dataloading", "dataabort", "data"]) {
        map.on(evt, () => {
          map && props.isLoading(!map.areTilesLoaded());
        });
      }
    }
  }, []);

  const style = useAppSelector(selectGLStyle);
  useEffect(() => {
    requestAnimationFrame(() => mapRef.current?.setStyle(style));
    console.debug("setStyle", style);
  }, [style]);

  const geolocationValue = useAppSelector((s) => selectGeolocation(s).value);
  const geolocationMarker = useRef<ml.Marker>();
  useEffect(() => {
    let marker = geolocationMarker.current;
    if (!marker) {
      const elem = document.createElement("div");
      elem.className =
        "w-[18px] h-[18px] bg-sky-600 rounded-full border border-[2px] border-white";
      marker = new ml.Marker({ element: elem });
      geolocationMarker.current = marker;
    }

    if (geolocationValue) {
      marker.setLngLat(geolocationValue.position);
      marker.addTo(mapRef.current);
    } else {
      marker.remove();
    }
  }, [geolocationValue]);

  return <div ref={nodeRef} className="map-base" />;
}

function computeMetersPerPixel(map: ml.Map) {
  const y = map.getContainer().clientHeight / 2;
  const a = map.unproject([0, y]);
  const b = map.unproject([1, y]);
  return a.distanceTo(b);
}
