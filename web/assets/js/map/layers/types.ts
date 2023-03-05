import * as mlStyle from '@maplibre/maplibre-gl-style-spec';

export type LayerDatas = {
  [id: string]: LayerData;
};

export type LayerSources = {
  [id: string]: LayerSource;
};

export interface LayerData {
  id: number;
  attribution?: string;
  spec: mlStyle.SourceSpecification;
}

export interface LayerSource {
  id: string;
  name: string;
  defaultOpacity: number | null;
  dependencies: string[];
  icon: string | null;
  glyphs: string | null;
  sprite: string | null;
  layerSpecs: mlStyle.LayerSpecification[];
}

export interface Layer {
  sourceId: string;
  opacity?: number;
}
