import { deserializeLngLat, Features } from '../features/features';

export default function computeFeaturesGeoJson(
  map: Features,
): GeoJSON.FeatureCollection {
  const json: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const feat of Object.values(map)) {
    if (feat.type === 'point') {
      json.push({
        id: feat.id,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: deserializeLngLat(feat.lngLat),
        },
        properties: {
          visible: feat.visible || true,
          name: feat.name,
          style: feat.style,
        },
      });
    } else if (feat.type === 'group') {
      // Ignore
    } else {
      console.info(`featuresGeoJson: unsupported type: ${feat.type}`, feat);
    }
  }

  return {
    type: 'FeatureCollection',
    features: json,
  };
}
