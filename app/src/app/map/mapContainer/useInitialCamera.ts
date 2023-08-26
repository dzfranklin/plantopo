import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraPosition } from './MapManager';

export type InitialCameraStatus =
  | { status: 'loading' }
  | { status: 'loaded'; value: CameraPosition | null };

type SaveCamera = (_: CameraPosition) => void;

export function useInitialCamera(
  mapId: number,
): [InitialCameraStatus, SaveCamera] {
  const [status, setStatus] = useState<InitialCameraStatus>({
    status: 'loading',
  });

  useEffect(() => {
    const stored = localStorage.getItem(`${mapId}-camera`);
    let value: CameraPosition | null = null;
    if (stored) value = JSON.parse(stored);
    setStatus({ status: 'loaded', value });
  }, [mapId]);

  const pendingSave = useRef<number | null>(null);
  const saveCamera = useCallback(
    (value: CameraPosition) => {
      if (pendingSave.current !== null) {
        cancelIdleCallback(pendingSave.current);
      }
      pendingSave.current = requestIdleCallback(
        () => localStorage.setItem(`${mapId}-camera`, JSON.stringify(value)),
        { timeout: 10_000 },
      );
    },
    [mapId],
  );

  return [status, saveCamera];
}
