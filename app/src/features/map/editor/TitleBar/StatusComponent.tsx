import ConnectedIcon from '@spectrum-icons/workflow/CloudOutline';
import DisconnectedIcon from '@spectrum-icons/workflow/CloudDisconnected';
import {
  useEngine,
  useHasUnsyncedChanges,
  useSyncTransportStatus,
} from '../engine/useEngine';
import { useCallback, useEffect, useRef, useState } from 'react';

export function StatusComponent() {
  const engine = useEngine();
  const status = useSyncTransportStatus();
  const hasUnsyncedChanges = useHasUnsyncedChanges();
  const [readyForCheck, setReadyForCheck] = useState(false);
  useEffect(() => {
    let ticker: number | null;
    const doCheck = () => {
      if (!engine || Date.now() - engine.createdAt < 500) {
        ticker = window.setTimeout(doCheck, 100);
      } else {
        setReadyForCheck(true);
      }
    };
    doCheck();
    return () => {
      if (ticker !== null) window.clearTimeout(ticker);
    };
  }, [engine]);
  return (
    <div className="flex items-center gap-2 pt-0.5 text-xs">
      {(readyForCheck && !status) ||
        (status?.type === 'connecting' && (
          <>
            <DisconnectedIcon height="20px" />
            <span>Connecting...</span>
          </>
        ))}
      {status?.type === 'connected' && (
        <>
          <button onClick={() => engine?.forceDisconnect()}>
            <ConnectedIcon height="20px" />
          </button>
          {hasUnsyncedChanges && (
            <span className="text-neutral-500">Syncing...</span>
          )}
        </>
      )}
      {readyForCheck && status?.type === 'disconnected' && (
        <>
          <DisconnectedIcon height="20px" />
          <div>
            <ReconnectingAt at={status.reconnectingAt} />
            <button
              onClick={() => status.reconnectNow()}
              className="px-1 underline"
            >
              Reconnect now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
function ReconnectingAt({ at }: { at: number }) {
  const [secondsLeft, setSecondsLeft] = useState(at);
  const pending = useRef<number | null>(null);
  const tick = useCallback(() => {
    const now = Date.now();
    const delta = Math.max(0, at - now);
    const seconds = Math.ceil(delta / 1000);
    setSecondsLeft(seconds);
    pending.current = window.setTimeout(tick, delta % 1000);
  }, [at]);
  useEffect(() => {
    tick();
    return () => {
      pending.current && window.clearTimeout(pending.current);
    };
  }, [tick]);
  return <span>Reconnecting in {`${secondsLeft} seconds`}</span>;
}
