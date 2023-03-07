import BaseMap from './base/BaseMap';
import { useState } from 'react';
import { useAppSelector } from './hooks';
import LoadingIndicator from './base/LoadingIndicator';
import Flash from './flash/Flash';
import Controls from './controls/Controls';
import MapSync from './sync/Sync';
import Sidebar from './sidebar/Sidebar';
import { useGlobalKeyboardShortcuts } from './keyboardShortcuts';
import { selectDidInitialLoad } from './sync/slice';
import Attribution from './Attribution';

export default function MapApp() {
  const loaded = useAppSelector(selectDidInitialLoad);
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const [attrib, setAttrib] = useState<string[]>([]);

  useGlobalKeyboardShortcuts();

  return (
    <div className="map-app">
      <MapSync />

      {loaded ? (
        <>
          <BaseMap isLoading={setBaseIsLoading} setAttribution={setAttrib} />
          <Attribution value={attrib} />
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
