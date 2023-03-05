import MapBase from './base/MapBase';
import { useState } from 'react';
import { useAppSelector } from './hooks';
import LoadingIndicator from './base/LoadingIndicator';
import classNames from '../classNames';
import Flash from './flash/Flash';
import Controls from './controls/Controls';
import MapSync from './sync/Sync';
import Sidebar from './sidebar/Sidebar';
import { useGlobalKeyboardShortcuts } from './keyboardShortcuts';
import { selectShouldCreditOS } from './layers/slice';
import { selectDidInitialLoad } from './sync/slice';

export default function MapApp() {
  const loaded = useAppSelector(selectDidInitialLoad);
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const creditOS = useAppSelector(selectShouldCreditOS);

  useGlobalKeyboardShortcuts();

  return (
    <div className="map-app">
      <MapSync />

      {loaded ? (
        <>
          <MapBase isLoading={setBaseIsLoading} />
          <CreditImages creditOS={creditOS} />
          <LoadingIndicator isLoading={baseIsLoading} />

          <Sidebar />

          <Controls />
        </>
      ) : (
        'TODO LOADING INDICATOR'
      )}

      <Flash />
    </div>
  );
}

function CreditImages(props: { creditOS: boolean }) {
  return (
    <div className="credit-images pointer-events-none flex flex-row gap-2 h-[24px] ml-[8px] mb-[8px]">
      <img src="/images/mapbox_logo.svg" className="h-full" />
      <img
        src="/images/os_logo.svg"
        className={classNames('h-full', props.creditOS || 'hidden')}
      />
    </div>
  );
}
