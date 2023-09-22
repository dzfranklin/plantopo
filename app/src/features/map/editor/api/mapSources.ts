import type * as ml from 'maplibre-gl';

export interface MapSources {
  layers: {
    [lid: string]: LayerSource;
  };
  tilesets: {
    [id: string]: ml.SourceSpecification;
  };
  sprites: {
    [id: string]: string; // id -> url
  };
}

export interface LayerSource {
  id: string;
  name: string;
  defaultOpacity: number; // 0..1
  attribution?: string; // Only if differs from tileset attribution
  sublayers: ml.LayerSpecification[];
  sublayerTilesets: string[];
  sprites?: string; // id
  // sublayer resolved id -> (property -> value)
  sublayerOpacity: Record<string, Record<string, unknown>>;
}
