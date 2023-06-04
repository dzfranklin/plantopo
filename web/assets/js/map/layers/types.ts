import * as mlStyle from '@maplibre/maplibre-gl-style-spec';

export type LayerDatas = {
  [id: string]: LayerData;
};

export type LayerSources = {
  [id: string]: LayerSource;
};

export interface LayerData {
  id: number;
  spec: mlStyle.SourceSpecification;
}

export interface LayerSource {
  id: string;
  name: string;
  defaultOpacity?: number;
  icon?: string;
  sprite?: string;
  layerSpecs: mlStyle.LayerSpecification[];
}

export interface Layer {
  id: string;
  attrs: {
    opacity?: number;
    [key: string]: unknown;
  };
}
