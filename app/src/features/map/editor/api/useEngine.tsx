import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SyncSocket } from './SyncSocket';
import { SyncEngine } from './SyncEngine';
import { EMPTY_SCENE, Scene, SceneFeature } from './SyncEngine/Scene';

const SyncSocketContext = createContext<SyncSocket | null>(null);

export function SyncSocketProvider({
  socket,
  children,
}: {
  socket: SyncSocket;
  children: ReactNode;
}) {
  return (
    <SyncSocketContext.Provider value={socket}>
      {children}
    </SyncSocketContext.Provider>
  );
}

export function useEngine(): SyncEngine | null {
  const socket = useContext(SyncSocketContext);
  if (!socket) {
    throw new Error('useSync() must be used within a SyncSocketProvider');
  }
  const [engine, setEngine] = useState<SyncEngine | null>(() => {
    const state = socket.state();
    return 'engine' in state ? state.engine : null;
  });
  useEffect(
    () =>
      socket.addStateListener((state) =>
        setEngine('engine' in state ? state.engine : null),
      ),
    [socket],
  );
  return engine;
}

export function useSceneSelector<T>(
  sel: (_: Scene, query: (fid: number) => SceneFeature | undefined) => T,
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
  fid: number,
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
