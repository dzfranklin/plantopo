import { LayerSource } from '../api/mapSources';
import { SyncGeometry } from '@/gen/sync_schema';

export type Scene = {
  timing: {
    start: number;
    end: number;
  };
  sidebarWidth: number;
  activeTool: 'point' | 'line';
  layers: {
    active: SceneLayer[];
    /** Ordered by name */
    inactive: InactiveSceneLayer[];
  };
  activeFeature: SceneFeature | null;
  features: {
    root: SceneRootFeature;
    /** Ordered by dfs of scene tree */
    selectedByMe: SceneFeature[];
    insertPlace: SceneFInsertPlace;
  };
};

export type SceneLayer = {
  id: string;
  idx: string;
  source: LayerSource;
  opacity: number | null;
  selectedByMe: boolean;
};

export type InactiveSceneLayer = {
  id: string;
  source: LayerSource;
  selectedByMe: boolean;
};

export type SceneRootFeature = {
  id: '';
  parent: null;
  children: SceneFeature[];
};

const EMPTY_FEATURE_ROOT: SceneRootFeature = {
  id: '',
  parent: null,
  children: [],
};

export type SceneFeature = {
  id: string;
  parent: SceneRootFeature | SceneFeature;
  idx: string;
  children: SceneFeature[];
  hidden: boolean;

  active: boolean;
  selectedByMe: boolean;
  selectedByPeers: string[] | null;
  hoveredByMe: boolean;

  geometry: SyncGeometry | null;

  name: string | null;
  color: string | null;
};

export type SceneFInsertPlace =
  | {
      at: 'firstChild';
      target: SceneFeature | SceneRootFeature;
    }
  | {
      at: 'before' | 'after';
      target: SceneFeature;
    };

export const DEFAULT_SIDEBAR_WIDTH = 200;

export const EMPTY_SCENE: Scene = {
  timing: {
    start: 0,
    end: 0,
  },
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  activeTool: 'line',
  layers: {
    active: [],
    inactive: [],
  },
  activeFeature: null,
  features: {
    root: EMPTY_FEATURE_ROOT,
    insertPlace: {
      at: 'firstChild',
      target: EMPTY_FEATURE_ROOT,
    },
    selectedByMe: [],
  },
};

export function nameForUnnamedFeature(feature: SceneFeature): string {
  if (!feature.geometry) {
    return 'Unnamed folder';
  }
  switch (feature.geometry.type) {
    case 'Point':
      return 'Unnamed point';
    case 'LineString':
      return 'Unnamed line';
  }
}
