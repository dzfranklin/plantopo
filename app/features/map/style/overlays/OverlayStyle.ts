import { StyleVariableSpec } from '@/features/map/style';
import {
  LayerSpecification as MLLayerSpecification,
  SourceSpecification as MLSourceSpecification,
} from 'maplibre-gl';

export interface OverlayStyle {
  id: string;
  name: string;
  region?: string;
  details?: string;
  versionMessage?: string;
  legendURL?: string;
  variables?: Record<string, StyleVariableSpec>;
  sources?: Record<string, MLSourceSpecification>;
  layers?: MLLayerSpecification[];
}

export type DynamicOverlayStyle = OverlayStyle & {
  // the dynamic function is expected to coalesce in-flight requests and cache internally to the extent reasonable.
  dynamic: () => Promise<Omit<OverlayStyle, 'id' | 'name'>>;
};
