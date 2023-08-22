import osLogo from './osLogo.svg';
import mapboxLogo from './mapboxLogo.svg';
import { SyncEngine } from '@/sync/SyncEngine';

export function AttributionControl({
  sidebarWidth,
  engine,
}: {
  sidebarWidth: number;
  engine: SyncEngine;
}) {
  return (
    <>
      <div
        className="z-30 h-[32px] absolute bottom-[8px] flex flex-row gap-3 min-w-fit pointer-events-none"
        style={{ left: `${sidebarWidth + 20}px` }}
      >
        <img src={mapboxLogo.src} alt="mapbox" />
        <img src={osLogo.src} alt="ordnance survey" />
      </div>
    </>
  );
}
