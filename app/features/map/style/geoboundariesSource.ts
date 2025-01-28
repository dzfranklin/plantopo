import * as ml from 'maplibre-gl';

export const geoboundariesSource: ml.SourceSpecification = {
  type: 'vector',
  url: 'pmtiles://https://plantopo-storage.b-cdn.net/geoboundaries.pmtiles',
};
