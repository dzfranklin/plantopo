import { idxBetween as _idxBetween } from './fracIdx';
import { Feature, FeatureBase, Features, ROOT_FEATURE } from './types';

export const idxBetween = _idxBetween;

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

export function featureCmp<T extends FeatureBase>(a: T, b: T) {
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

// In the order west, south, east, north
export const computeFeatureBbox = (
  feature: Feature,
  features: Features,
): [number, number, number, number] | undefined => {
  if (feature.type === 'point') {
    const [lng, lat] = JSON.parse(feature.lngLat);
    return [lng, lat, lng, lat];
  } else if (feature.type === 'route') {
    // TODO:
  } else if (feature.type === 'group') {
    let bbox;
    for (const child of computeFeaturesList(feature.id, features)) {
      const childBbox = computeFeatureBbox(child, features);
      if (!bbox) {
        bbox = childBbox;
      } else if (childBbox) {
        bbox[0] = Math.min(bbox[0], childBbox[0]);
        bbox[1] = Math.min(bbox[1], childBbox[1]);
        bbox[2] = Math.max(bbox[2], childBbox[2]);
        bbox[3] = Math.max(bbox[3], childBbox[3]);
      }
    }
    return bbox;
  }
};
