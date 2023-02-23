export type Feature = FeatureGroup | Point | Route | RoutePoint;
export type Features = { [id: string]: Feature };

interface Base {
  id: Id;
  // RoutePoint parent must be Route. All others must have a FeatureGroup or
  // null as the parent
  parent: Id | null;
  idx: Index;
  // Use filter set on the style
  visible: boolean;
}

export interface FeatureGroup extends Base {
  type: 'group';
  name?: string;
  details?: string;
  // Children default to their parents' styles if they don't set a property
  childPointStyle?: PointStyle;
  childRouteLabelStyle?: PointStyle;
  childRouteLineStyle?: RouteLineStyle;
}

export interface Point extends Base {
  type: 'point';
  coords: LngLat;
  name?: string;
  details?: string;
  style?: PointStyle;
}

export interface Route extends Base {
  type: 'route';
  name?: string;
  details?: string;
  // Use the line geojson as a symbol source as in <http://jsfiddle.net/brianssheldon/wm18a33d/27/>
  // 'symbol-placement': 'line' (or maybe 'line-center'), but we want it to always be visible
  labelStyle?: PointStyle;
  lineStyle?: RouteLineStyle;
}

export interface RoutePoint extends Base {
  type: 'route/point';
  parent: Id;
  coords: LngLat;
}

type Id = string; // Hyphenated UUID
type Index = string;
type LngLat = string; // lng, lat as JSON [number, number]

// We're styling with a subset of ml styles. For now a little input box with
// pointer capture to adjust, plus a fast path for updates, would be nice.
// That'd go in advanced, common things get case-specific fields

// To make this work I'll need to implement merging sprite/glyphs
// See <https://github.com/mapbox/fontnik> and <https://github.com/mapbox/spritezero>

// All the options I'm providing users support data-driven styling
//
// To do the partial updates to the source proprties as the user edits we could
// check out sana labs diff

// symbol layer
interface PointStyle {
  // Icon paint
  'icon-color'?: Color;
  'icon-halo-blur'?: number;
  'icon-halo-color'?: Color;
  'icon-halo-width'?: number;
  'icon-opacity'?: number;
  // Icon layout
  'icon-anchor'?: string;
  'icon-image'?: string; // Figure out a good naming scheme
  'icon-offset'?: string; // JSON [number, number]
  'icon-size'?: number;
  // Text paint
  'text-color'?: Color;
  'text-halo-blur'?: number;
  'text-halo-color'?: Color;
  'text-halo-number'?: number;
  'text-opacity'?: number;
  // Text layout
  'text-anchor'?: string;
  'text-font'?: Font;
  'text-justify'?: string;
  'text-letter-spacing'?: number;
  'text-max-width'?: number;
  'text-offset'?: string; // JSON [number, number]
  'text-rotate'?: number;
  'text-size'?: number;
  // Always layout
  // 'icon-allow-overlap': true
  // 'icon-ignore-placement': true
  // 'symbol-sort-key': idx
  // 'text-allow-overlap': true;
  // 'text-field': the geojson prop name
  // 'text-ignore-placement': true
}

interface RouteLineStyle {
  // Paint
  'line-blur'?: number;
  'line-color'?: Color;
  'line-dasharray'?: string; // JSON number[]
  'line-gap-width'?: number;
  'line-opacity'?: number;
  'line-width'?: number;
  // Always layout
  // 'line-cap': 'round'
  // 'line-join': 'round'
  // 'line-sort-key': idx
}

type Color = string; // hex rgba
type Font = string; // JSON [primary, fallback]
