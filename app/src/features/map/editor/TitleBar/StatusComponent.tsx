import ConnectedIcon from '@spectrum-icons/workflow/CloudOutline';
import DisconnectedIcon from '@spectrum-icons/workflow/CloudDisconnected';
import { useStateStatus } from '../engine/useEngine';
import { useCallback, useEffect, useRef, useState } from 'react';

export function StatusComponent() {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StatusIcon />
      <StatusMessage />
    </div>
  );
}

function StatusIcon() {
  const { transport } = useStateStatus();
  if (transport.type === 'connected') {
    return (
      <button onClick={() => transport.disconnect()}>
        <ConnectedIcon height="20px" />
      </button>
    );
  } else if (transport.type === 'connecting') {
    return <DisconnectedIcon height="20px" />;
  } else if (transport.type === 'disconnected') {
    return <DisconnectedIcon height="20px" />;
  }
}

function StatusMessage() {
  const { transport, unsyncedChanges, hasChanges, loaded } = useStateStatus();
  if (transport.type === 'connected') {
    return (
      <span className="text-neutral-500">
        {!loaded && 'Loading... '}
        {unsyncedChanges && 'Saving...'}
        {hasChanges && !unsyncedChanges && 'All changes saved'}
      </span>
    );
  } else if (transport.type === 'connecting') {
    return <span>Connecting...</span>;
  } else if (transport.type === 'disconnected') {
    return (
      <span>
        <ReconnectingAt at={transport.reconnectingAt} />.{' '}
        <button
          onClick={() => transport.reconnectNow()}
          className="px-1 underline"
        >
          Reconnect now
        </button>
      </span>
    );
  }
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
