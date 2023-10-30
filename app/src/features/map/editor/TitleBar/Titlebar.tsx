import { MapIcon } from '@/generic/MapIcon';
import { TitlebarMenu } from './TitlebarMenu';
import { useMapMeta, usePutMapMetaMutation } from '../../api/mapMeta';
import ConnectedIcon from '@spectrum-icons/workflow/CloudOutline';
import DisconnectedIcon from '@spectrum-icons/workflow/CloudDisconnected';
import { useMapId } from '../useMapId';
import { useEngine, useSyncTransportStatus } from '../engine/useEngine';
import { useCallback, useEffect, useRef, useState } from 'react';
import cls from '@/generic/cls';

export function Titlebar() {
  return (
    <div
      className={cls(
        'grid grid-cols-[min-content_1fr] grid-rows-[min-content_min-content]',
        'pl-3 pr-1 py-1 items-center border-b border-neutral-300 bg-neutral-100',
      )}
    >
      <div className="col-start-1 pr-2 row-span-full">
        {/* Ordinary navigation avoids bugs around pages router -> app router  */}
        <a href="/dashboard" className="text-blue-700">
          <MapIcon />
        </a>
      </div>

      <div className="flex justify-between col-start-2 row-start-1 gap-2 mx-1">
        <TitleEditComponent />
        <StatusComponent />
      </div>

      <div className="flex items-center col-start-2 row-start-2 gap-2 grow">
        <TitlebarMenu />
      </div>
    </div>
  );
}

function StatusComponent() {
  const engine = useEngine();
  const status = useSyncTransportStatus();
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
    <div className="pt-1 text-xs">
      {(readyForCheck && !status) ||
        (status?.type === 'connecting' && (
          <>
            <span>Connecting...</span>
            <DisconnectedIcon height="20px" />
          </>
        ))}
      {status?.type === 'connected' && <ConnectedIcon height="20px" />}
      {readyForCheck && status?.type === 'disconnected' && (
        <>
          <ReconnectingAt at={status.reconnectingAt} />
          <button
            onClick={() => status.reconnectNow()}
            className="px-1 underline"
          >
            Reconnect now
          </button>
          <DisconnectedIcon height="20px" />
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
    const delta = Math.max(0, at - now) / 1000;
    const seconds = Math.ceil(delta);
    setSecondsLeft(seconds);
    const nextTick = (Math.ceil(delta) - delta) * 1000;
    pending.current = window.setTimeout(tick, nextTick);
  }, [at]);
  useEffect(() => {
    tick();
    return () => {
      pending.current && window.clearTimeout(pending.current);
    };
  }, [tick]);
  return <>Reconnecting in {`${secondsLeft} seconds`}</>;
}

function TitleEditComponent() {
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [value, setValue] = useState<string | null>(null);
  const mutation = usePutMapMetaMutation(mapId, {
    onSuccess: () => setValue(null),
  });
  return (
    <input
      className={cls(
        'grow px-1 py-0.5 bg-neutral-100 rounded outline-none border border-transparent',
        'font-normal text-sm',
        'hover:border-neutral-500 active:border-neutral-500 focus:border-neutral-500 focus:ring-0',
      )}
      placeholder={meta.data ? 'Unnamed map' : 'Loading...'}
      value={value ?? meta.data?.name ?? ''}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== null) {
          mutation.mutate({ name: value });
        }
      }}
    />
  );
}
