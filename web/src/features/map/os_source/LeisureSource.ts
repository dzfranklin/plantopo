import XYZ from "ol/source/XYZ";
import TileGrid from "ol/tilegrid/TileGrid";
import { osBrandStatement } from "./Brand";

// From <https://github.com/OrdnanceSurvey/os-api-branding>.

// TODO: Redirect thru server for key
// TODO: Restrict to avoid 404s

import proj4 from "proj4";
import { register as registerOlProj4 } from "ol/proj/proj4";

proj4.defs(
  "EPSG:27700",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs"
);
registerOlProj4(proj4);

export const tileGrid = new TileGrid({
  resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
  origin: [-238375.0, 1376256.0],
});

export interface Options {
  key: string;
}

export default class LeisureSource extends XYZ {
  constructor(options: Options) {
    const url =
      "https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/{z}/{x}/{y}.png?key=" +
      options.key;

    super({
      url,
      attributions: [osBrandStatement],
      attributionsCollapsible: false,
      projection: "EPSG:27700",
      crossOrigin: "anonymous",
      opaque: true,
      tileGrid,
      cacheSize: undefined, // consider tuning
      reprojectionErrorThreshold: 0.2,
      // tileLoadFunction: (tile, url) => {
      //   console.debug("Would load", url);
      // },
    });
  }
}
