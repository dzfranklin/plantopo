import { useRef, useEffect } from "react";
import { FlyToOptions as GLFlyToOptions, Map as MapGL } from "maplibre-gl";
import { useAppDispatch, useAppSelector, useAppStore } from "./hooks";
import {
  flyTo,
  mapClick,
  reportViewAt,
  selectGLStyle,
  selectTokens,
  selectViewAt,
} from "./mapSlice";
import "../userSettings";
import { startListening } from "./listener";
import "../map";

export interface Props {
  isLoading: (_: boolean) => void;
}

const FLY_TO_SPEED = 2.8;

export default function MapApp(props: Props) {
  const store = useAppStore();
  const dispatch = useAppDispatch();

  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapGL>();

  useEffect(() => {
    if (!mapRef.current) {
      const state = store.getState();
      const tokens = selectTokens(state);
      const viewAt = selectViewAt(state);

      const map = new MapGL({
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
        effect: async (action, l) => {
          const { center, zoom, pitch, bearing } = action.payload;

          let opts: GLFlyToOptions = {
            center,
            zoom,
            pitch,
            bearing,
            speed: FLY_TO_SPEED,
          };

          if (window.userSettings.disableAnimation) {
            opts.duration = 0;
          }

          mapRef.current?.flyTo(opts);
        },
      });

      // Note that move is fired during any transition
      map.on("move", () => {
        const center = map.getCenter();
        dispatch(
          reportViewAt({
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          })
        );
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

  return <div ref={nodeRef} className="map-base" />;
}
