import { idxBetween } from './fracIdx';

export type Feature =
  | GroupFeature
  | PointFeature
  | RouteFeature
  | RoutePointFeature;

export type Features = { [id: string]: Feature };

export const ROOT_FEATURE = 'db0d225b-6fb4-444e-a18e-13f637036bff';
export const DEFAULT_POINT_SPRITE = 'maki-circle-stroked';

export interface FeatureBase {
  id: Id;
  // Describes where this feature is visually in the tree
  //
  // RoutePoint parent must be Route.All others must have a FeatureGroup or
  // null as the parent
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
  lngLat: LngLat;
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
}

export interface RoutePointFeature extends FeatureBase {
  type: 'route/point';
  lngLat: LngLat;
}

type Id = string; // Hyphenated UUID
type Index = string; // parent uuid concatenated with fracIdx
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

export const deleteFeatures = (
  features: Features,
  trash: Features,
  toDelete: Feature,
): { features: Features; trash: Features } => {
  if (toDelete.type === 'group') {
    for (const child of computeFeaturesList(toDelete.id, features)) {
      ({ features, trash } = deleteFeatures(features, trash, child));
    }
  }

  features = Object.fromEntries(
    Object.entries(features).filter(([id, _feat]) => id !== toDelete.id),
  );

  trash = { ...trash, [toDelete.id]: toDelete };

  return { features, trash };
};

export function nextFeature(
  features: Features,
  beforeId: string,
): Feature | undefined {
  const before = features[beforeId];
  if (!before) return;

  const parent = parentIdOf(before);
  const list = computeFeaturesDisplayList(parent, features);

  const beforeIdx = list.findIndex((f) => f.id === beforeId);
  if (beforeIdx === -1) return;

  return list.at(beforeIdx + 1) || list.at(beforeIdx - 1);
}

export const computeFeaturesList = (
  parentId: string,
  features: Features,
): Feature[] =>
  Object.values(features).filter((f) => parentIdOf(f) === parentId);

export const computeFeaturesDisplayList = (
  parentId: string,
  features: Features,
): Feature[] =>
  sortFeatures(computeFeaturesList(parentId, features)) as Feature[];

export function sortFeatures<T extends FeatureBase>(features: T[]) {
  return features.sort(featureCmp);
}

export function computeAtAfter(features: Features, beforeId?: string): string {
  const beforeFeature = beforeId !== undefined ? features[beforeId] : undefined;

  let parentId: string;
  let beforeIdx: string;
  let afterIdx: string;

  if (beforeFeature) {
    beforeIdx = idxOf(beforeFeature);
    parentId = parentIdOf(beforeFeature);

    const list = computeFeaturesDisplayList(parentId, features);

    const beforeLinearIdx = list.findIndex((f) => f.id === beforeFeature.id);
    if (beforeLinearIdx < 0) throw new Error('afterId does not exist');

    const afterFeature = list[beforeLinearIdx + 1];
    afterIdx = afterFeature ? idxOf(afterFeature) : '';
  } else {
    parentId = ROOT_FEATURE;

    const list = computeFeaturesDisplayList(ROOT_FEATURE, features);
    const last = list[list.length - 1];
    beforeIdx = last ? idxOf(last) : '';
    afterIdx = '';
  }

  const idx = idxBetween(beforeIdx, afterIdx);
  return serializeAt(parentId, idx);
}

const UUID_STR_LEN = 36;

export const parentIdOf = (f: FeatureBase | undefined) => parentIdOfAt(f?.at);
export const parentIdOfAt = (at: string | undefined) =>
  at ? at.substring(0, UUID_STR_LEN) : ROOT_FEATURE;
export const idxOf = (f: FeatureBase) => idxOfAt(f.at);
export const idxOfAt = (at: string) => at.substring(UUID_STR_LEN + 1);
export const serializeAt = (parentId: string, idx: string) =>
  parentId + '.' + idx;

function featureCmp<T extends FeatureBase>(a: T, b: T) {
  const aIdx = idxOf(a);
  const bIdx = idxOf(b);
  if (aIdx < bIdx) return -1;
  if (aIdx > bIdx) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export const serializeLngLat = (value: [number, number]) =>
  JSON.stringify(value);
export const deserializeLngLat = (value: string): [number, number] =>
  JSON.parse(value);
