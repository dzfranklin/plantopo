import "../../node_modules/ol/ol.css";

import { Map as MapGL } from "maplibre-gl";
import { Map as MapOL } from "ol";
import TileLayer from "ol/layer/Tile";
import XYZSource from "ol/source/XYZ";
import View from "ol/View";
import TileGrid from "ol/tilegrid/TileGrid";
import * as proj from "ol/proj";
import * as olProj4 from "ol/proj/proj4";
import proj4 from "proj4";
import { LngLat } from "maplibre-gl";

proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs"
);
olProj4.register(proj4);

const attribText = `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`;
const attribLayerId = "os-explorer-attribution";

export interface Options {
  key: string;
  attachTo: MapGL;
  loadStart: () => void;
  loadEnd: () => void;
}

export default class OSExplorerMap {
  private detached: boolean = false;
  private mapOL: MapOL;
  private mapGL: MapGL;
  private container: HTMLDivElement;

  constructor({ key, attachTo, loadStart, loadEnd }: Options) {
    this.mapGL = attachTo;

    const parent = this.mapGL.getCanvasContainer();
    const container = document.createElement("div");
    parent.append(container);
    this.container = container;

    const target = document.createElement("div");
    target.className = "relative -z-50";
    // Suppress map not visible warning before we set in render
    target.style.width = target.style.height = "1px";
    container.append(target);

    const attribImg = document.createElement("img");
    attribImg.src = "/images/os_logo.svg";
    attribImg.alt = "Ordnance Survey";
    attribImg.className =
      "pointer-events-none absolute bottom-0 left-0 z-50 m-[8px] h-[24px] w-[90px]";
    container.append(attribImg);

    // TODO: This is temporary so we can debug visually
    this.mapGL.getCanvas().style.opacity = "0.8";

    this.onceGLLoad(
      () =>
        this.mapGL.addLayer({
          id: attribLayerId,
          type: "fill",
          source: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
            attribution: attribText,
          },
        } as any) // workaround type def bug
    );

    const tileGrid = new TileGrid({
      resolutions: [
        896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75,
      ],
      origin: [-238375.0, 1376256.0],
    });

    const source = new XYZSource({
      url:
        "http://geder:4003/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key&plantopoKey=" +
        key,
      projection: "EPSG:27700",
      tileGrid,
      reprojectionErrorThreshold: 0.2,
    });

    this.mapOL = new MapOL({
      target,
      layers: [
        new TileLayer({
          source,
          extent: proj.transformExtent(
            [-238375.0000149319, 0.0, 900000.00000057, 1376256.0000176653],
            "EPSG:27700",
            "EPSG:3857"
          ),
        }),
      ],
      view: new View({
        projection: "EPSG:3857",
      }),
      interactions: [],
      controls: [],
    });

    // OL calls this internally to pend renders. By patching it to a noop we ensure
    // control of when the OL map renders.
    this.mapOL.render = () => {};

    source.addEventListener("tileloadend", () => this.mapGL.triggerRepaint());
    this.mapGL.on("render", this.render.bind(this));

    this.mapOL.on("loadstart", () => loadStart());
    this.mapOL.on("loadend", () => loadEnd());
  }

  detach() {
    this.detached = true;
    this.container.remove();
    this.onceGLLoad(() => this.mapGL.removeLayer(attribLayerId));
  }

  private onceGLLoad(fn: () => void) {
    if (this.mapGL.loaded()) {
      fn();
    } else {
      this.mapGL.on("load", () => fn());
    }
  }

  private render() {
    if (this.detached) return;

    const { mapGL, mapOL } = this;
    const view = mapOL.getView();

    const glStyle = mapGL.getCanvas().style;
    const olStyle = mapOL.getTargetElement().style;
    if (olStyle.width != glStyle.width || olStyle.height != glStyle.height) {
      olStyle.width = glStyle.width;
      olStyle.height = glStyle.height;
      mapOL.updateSize();
    }

    // Rotation complicates resolution calculation, so disable for now
    // view.setRotation((-Math.PI * mapGL.getBearing()) / 180);
    if (mapGL.getBearing() !== 0) throw new Error("Rotation unsupported");

    view.setResolution(
      transformGLTo(mapGL.unproject([1, 1]))[0] -
        transformGLTo(mapGL.unproject([0, 0]))[0]
    );

    view.setCenter(transformGLTo(mapGL.getCenter()));

    // This is the callback OL requestAnimationFrames
    (mapOL as any).animationDelay_(Date.now());
  }
}

const transformGLTo = (lnglat: LngLat) =>
  proj.transform([lnglat.lng, lnglat.lat], "EPSG:4326", "EPSG:3857");
