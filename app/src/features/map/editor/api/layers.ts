import _LAYERS from '../../../../../../layer_data/layers.json';
import type * as ml from 'maplibre-gl';

// typescript otherwise overspecifies to exactly the shape of the file
export const LAYERS: {
  layers: {
    [lid: string]: LayerData;
  };
  tilesets: {
    [id: string]: ml.SourceSpecification;
  };
  sprites: {
    [id: string]: string; // id -> url
  };
} = _LAYERS as any;

export interface LayerData {
  lid: number;
  name: string;
  defaultOpacity: number; // 0..1
  attribution?: string; // Only if differs from tileset attribution
  sublayers: ml.LayerSpecification[];
  sublayerTilesets: string[];
  sprites?: string; // id
  // sublayer resolved id -> (property -> value)
  sublayerOpacity: Record<string, Record<string, unknown>>;
}
