import proj4 from 'proj4';
import { register as registerOLProj4 } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 ' +
    '+x_0=400000 +y_0=-100000 +ellps=airy ' +
    '+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 ' +
    '+units=m +no_defs',
);
registerOLProj4(proj4);

export const olProj3857 = getProjection('EPSG:3857')!; // web mercator

export const olProj27700 = getProjection('EPSG:27700')!; // gb
olProj27700.setExtent([0, 0, 700000, 1300000]);
