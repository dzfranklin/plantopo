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
import { EditorEngine, EngineCommand } from './EditorEngine';
import { SyncTransportStatus } from '../api/SyncTransport';
import { UndoStatus } from './DocStore';
import { KeyBinding } from './Keymap';

const EngineContext = createContext<EditorEngine | null>(null);

export function EditorEngineProvider({
  engine,
  children,
}: {
  engine: EditorEngine | null;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!engine) return;
    const handler = (evt: KeyboardEvent) => {
      if (
        evt.target instanceof HTMLInputElement ||
        evt.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const executed = engine.executeKeyBinding({
        key: evt.key,
        ctrl: evt.ctrlKey,
        shift: evt.shiftKey,
        alt: evt.altKey,
        meta: evt.metaKey,
      });
      if (executed) {
        evt.preventDefault();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => {
      window.removeEventListener('keydown', handler, { capture: true });
    };
  }, [engine]);

  return (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  );
}

export function useEngine(): EditorEngine | null {
  return useContext(EngineContext);
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

export function useSyncTransportStatus(): SyncTransportStatus | null {
  const engine = useEngine();
  const [value, setValue] = useState<SyncTransportStatus | null>(null);
  useEffect(() => engine?.addTransportStatusListener(setValue), [engine]);
  return value;
}

export function useHasUnsyncedChanges(): boolean {
  const engine = useEngine();
  const [value, setValue] = useState(engine?.hasUnsyncedChanges() ?? false);
  useEffect(() => engine?.addHasUnsyncedListener(setValue), [engine]);
  return value;
}

export function useUndoStatus(): UndoStatus | undefined {
  const engine = useEngine();
  const [value, setValue] = useState(engine?.undoStatus());
  useEffect(() => engine?.addUndoStatusListener(setValue), [engine]);
  return value;
}

export function useKeyBindingsFor(cmd: EngineCommand): readonly KeyBinding[] {
  const engine = useEngine();
  const [value, setValue] = useState<readonly KeyBinding[]>([]);
  useEffect(() => {
    if (!engine) return;
    setValue(engine.keymap().lookupByCmd(cmd));
    return engine.addKeymapListener((keymap) =>
      setValue(keymap.lookupByCmd(cmd)),
    );
  }, [cmd, engine]);
  return value;
}
