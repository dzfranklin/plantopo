import { LayerSource } from '../mapSources';
import { FGeometry } from '../propTypes';

export type Scene = {
  sidebarWidth: number;
  layers: {
    active: SceneLayer[];
    /** Ordered by name */
    inactive: InactiveSceneLayer[];
  };
  features: {
    root: SceneRootFeature;
    insertPlace: SceneFInsertPlace;
  };
};

export type SceneLayer = {
  id: number;
  idx: string;
  source: LayerSource;
  opacity: number | null;
  selectedByMe: boolean;
  selectedByPeers: string[] | null;
};

export type InactiveSceneLayer = {
  id: number;
  source: LayerSource;
  selectedByMe: boolean;
  selectedByPeers: string[] | null;
};

export type SceneRootFeature = {
  id: 0;
  parent: null;
  children: SceneFeature[];
};

const EMPTY_FEATURE_ROOT: SceneRootFeature = {
  id: 0,
  parent: null,
  children: [],
};

export type SceneFeature = {
  id: number;
  parent: SceneRootFeature | SceneFeature;
  idx: string;
  children: SceneFeature[];
  hidden: boolean;

  selectedByMe: boolean;
  selectedByPeers: string[] | null;

  geometry: FGeometry | null;

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
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  layers: {
    active: [],
    inactive: [],
  },
  features: {
    root: EMPTY_FEATURE_ROOT,
    insertPlace: {
      at: 'firstChild',
      target: EMPTY_FEATURE_ROOT,
    },
  },
};

export function nameForUnnamedFeature(feature: SceneFeature): string {
  return `Unnamed ${feature.geometry?.type ?? 'Feature'}`;
}