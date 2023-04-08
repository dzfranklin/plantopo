export type Feature = GroupFeature | PointFeature | RouteFeature;

export type Features = { [id: string]: Feature };

export const ROOT_FEATURE = 'db0d225b-6fb4-444e-a18e-13f637036bff';
export const DEFAULT_POINT_SPRITE = 'maki-circle-stroked';

export const FEATURE_TYPES = new Set(['group', 'point', 'route']);
export type FeatureType = 'group' | 'point' | 'route';
export const isFeatureType = (type: unknown): type is FeatureType =>
  typeof type === 'string' && FEATURE_TYPES.has(type);

// TODO: We no longer need the json string hack now we're doing sync manually

export interface FeatureBase {
  id: Id;
  // Describes where this feature is visually in the tree. Must have a
  // FeatureGroup or null as the parent.
  at: Index;
  // Use filter set on the style
  visible?: boolean;
}

export interface GroupFeature extends FeatureBase {
  type: 'group';
  name?: string;
  details?: string;
  // Children default to their parents' styles if they don't set a property
  childPointStyle?: PointStyle;
  childRouteLabelStyle?: PointStyle;
  childRouteLineStyle?: RouteLineStyle;
}

export interface PointFeature extends FeatureBase {
  type: 'point';
  lngLat?: LngLat;
  name?: string;
  details?: string;
  style?: PointStyle;
}

export interface RouteFeature extends FeatureBase {
  type: 'route';
  name?: string;
  details?: string;
  // Use the line geojson as a symbol source as in <http://jsfiddle.net/brianssheldon/wm18a33d/27/>
  // 'symbol-placement': 'line' (or maybe 'line-center'), but we want it to always be visible
  labelStyle?: PointStyle;
  lineStyle?: RouteLineStyle;
  points?: string;
}

type Id = string; // Hyphenated UUID
export type Index = [string, string]; // parent uuid concatenated with fracIdx
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
export interface PointStyle {
  // Icon paint
  'icon-color'?: Color;
  'icon-halo-blur'?: number;
  'icon-halo-color'?: Color;
  'icon-halo-width'?: number;
  'icon-opacity'?: number;
  // Icon layout
  'icon-anchor'?: string;
  'icon-image'?: string;
  'icon-offset'?: string; // JSON [number, number]
  'icon-size'?: number;
  'icon-size-zoomed-out-multiplier'?: number;
  // Text paint
  'text-color'?: Color;
  'text-halo-blur'?: number;
  'text-halo-color'?: Color;
  'text-halo-width'?: number;
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
}

export interface RouteLineStyle {
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
