import { MapIcon } from '@/generic/MapIcon';
// import { useMapMeta } from '../../api/useMapMeta';
import Link from 'next/link';
// import { useEngine } from '../api/useEngine';
// import { ArrowPathIcon as SyncingChangesIcon } from '@heroicons/react/24/outline';
// import DisconnectedIcon from '@spectrum-icons/workflow/CloudDisconnected';
// import { useCallback, useEffect, useRef, useState } from 'react';

export function Titlebar() {
  // TODO:
  return (
    <div className="flex gap-2 px-1.5 items-center overflow-hidden h-[30px] text-sm border-b border-neutral-300 bg-neutral-100">
      <Link href="/" className="text-blue-700">
        <MapIcon />
      </Link>
    </div>
  );
  // const sync = useEngine();
  // const meta = useMapMeta(sync.mapId);

  // return (
  //   <div className="flex gap-2 px-1.5 items-center overflow-hidden h-[30px] text-sm border-b border-neutral-300 bg-neutral-100">
  //     <Link href="/" className="text-blue-700">
  //       <MapIcon />
  //     </Link>
  //     <span className="truncate">
  //       {meta.data ? meta.data.name || 'Unnamed map' : 'Loading...'}
  //     </span>

  //     {sync.pendingChanges > 0 && sync.status === 'connected' && (
  //       <>
  //         <SyncingChangesIcon height="20px" />
  //         Saving...
  //       </>
  //     )}
  //     {sync.state.status === 'disconnected' && (
  //       <>
  //         <DisconnectedIcon height="20px" />
  //         Disconnected. <ReconnectingAt at={sync.state.nextReconnect} />
  //       </>
  //     )}
  //     {sync.status === 'reconnecting' && (
  //       <>
  //         <DisconnectedIcon height="20px" />
  //         Trying to connect...
  //       </>
  //     )}

  //     {sync.pendingChanges > 0 && (
  //       <span>
  //         {sync.pendingChanges === 1 && '1 unsaved change'}
  //         {sync.pendingChanges > 1 && `${sync.pendingChanges} unsaved changes`}
  //       </span>
  //     )}
  //   </div>
  // );
}

// function ReconnectingAt({ at }: { at: number }) {
//   const [secondsLeft, setSecondsLeft] = useState(at);
//   const pending = useRef<number | null>(null);
//   const tick = useCallback(() => {
//     const now = Date.now();
//     const delta = Math.min(0, now - at) / 1000;
//     const seconds = Math.ceil(delta);
//     setSecondsLeft(seconds);
//     const nextTick = (Math.ceil(delta) - delta) * 1000;
//     pending.current = window.setTimeout(tick, nextTick);
//   }, [at]);
//   useEffect(() => {
//     tick();
//     return () => {
//       pending.current && window.clearTimeout(pending.current);
//     };
//   }, [tick]);
//   return (
//     <>Reconnecting {secondsLeft > 0 ? `in ${secondsLeft} seconds` : 'now'}</>
//   );
// }
