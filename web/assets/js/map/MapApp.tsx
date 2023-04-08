import BaseMap from './base/BaseMap';
import { useEffect, useState } from 'react';
import LoadingIndicator from './base/LoadingIndicator';
import Flash from './flash/Flash';
import Controls from './controls/Controls';
import Sidebar from './sidebar/Sidebar';
import { useGlobalKeyboardShortcuts } from './keyboardShortcuts';
import Attribution from './Attribution';
import { setup as setupSync } from './sync';

export default function MapApp() {
  const [baseIsLoading, setBaseIsLoading] = useState(true);
  const [attrib, setAttrib] = useState<string[]>([]);
  const [syncInitialized, setSyncInitialized] = useState(false);

  useGlobalKeyboardShortcuts();

  useEffect(() => {
    let clientId = 42; // TODO:
    setupSync(clientId).then(() => setSyncInitialized(true));
  }, []);

  return (
    <div className="map-app">
      {syncInitialized && (
        <>
          <BaseMap isLoading={setBaseIsLoading} setAttribution={setAttrib} />
          <Attribution value={attrib} />
          <LoadingIndicator isLoading={baseIsLoading} />

          <Sidebar />

          <Controls />

          <Flash />
        </>
      )}
    </div>
  );
}
