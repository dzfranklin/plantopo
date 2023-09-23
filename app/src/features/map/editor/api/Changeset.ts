import { FeatureChange, LayerChange } from '@/gen/sync_schema';

export interface Changeset {
  fdelete?: string[];
  fadd?: string[];
  fset?: Record<string, FeatureChange>;
  lset?: Record<string, LayerChange>;
}
