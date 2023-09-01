import { ReactNode, createContext, useContext } from 'react';
import { Scene, EMPTY_SCENE } from './SyncEngine/Scene';

const SceneContext = createContext(EMPTY_SCENE);

export function SceneProvider({
  scene,
  children,
}: {
  scene: Scene;
  children: ReactNode;
}) {
  return (
    <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
  );
}

export function useScene<T>(selector: (scene: Scene) => T) {
  return selector(useContext(SceneContext));
}
