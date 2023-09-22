import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { EMPTY_SCENE, Scene, SceneFeature } from './Scene';
import { EditorEngine } from './EditorEngine';

const EngineContext = createContext<EditorEngine | null>(null);

export function EditorEngineProvider({
  engine,
  children,
}: {
  engine: EditorEngine;
  children: ReactNode;
}) {
  return (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  );
}

export function useEngine(): EditorEngine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error('useEngine must be used within an EditorEngineProvider');
  }
  return engine;
}

export function useSceneSelector<T>(
  sel: (_: Scene, query: (fid: string) => SceneFeature | undefined) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const engine = useEngine();

  const [value, setValue] = useState(() =>
    sel(engine?.scene ?? EMPTY_SCENE, (fid) => engine?.getFeature(fid)),
  );

  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const eqRef = useRef(equalityFn);
  useEffect(() => {
    eqRef.current = equalityFn;
  }, [equalityFn]);

  useEffect(
    () =>
      engine?.addSceneSelector(
        (scene, query) => selRef.current(scene, query),
        setValue,
        (a, b) => (eqRef.current ? eqRef.current(a, b) : a === b),
      ),
    [engine],
  );

  return value;
}

export function useSceneFeature<T>(
  fid: string,
  sel: (_: SceneFeature) => T,
  equalityFn?: (a?: T, b?: T) => boolean,
): T | undefined {
  const engine = useEngine();

  const [value, setValue] = useState(() => {
    const feature = engine?.getFeature(fid);
    return feature ? sel(feature) : undefined;
  });

  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const fidRef = useRef(fid);
  useEffect(() => {
    fidRef.current = fid;
  }, [fid]);

  const eqRef = useRef(equalityFn);
  useEffect(() => {
    eqRef.current = equalityFn;
  }, [equalityFn]);

  const sceneSel = useCallback(() => {
    const feature = engine?.getFeature(fidRef.current);
    return feature ? selRef.current(feature) : undefined;
  }, [engine]);

  useEffect(
    () =>
      engine?.addSceneSelector(sceneSel, setValue, (a, b) =>
        eqRef.current ? eqRef.current(a, b) : a === b,
      ),
    [engine, equalityFn, sceneSel],
  );
  return value;
}
