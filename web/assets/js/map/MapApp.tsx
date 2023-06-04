import BaseMap from './base/BaseMap';
import { useEffect, useState } from 'react';
import LoadingIndicator from './base/LoadingIndicator';
import Flash from './flash/Flash';
import Controls from './controls/Controls';
import Sidebar from './sidebar/Sidebar';
import { useGlobalKeyboardShortcuts } from './keyboardShortcuts';
import Attribution from './Attribution';
import { ViewAt } from './ViewAt';
import { SyncToken } from './sync/types';
import { SyncClient } from './sync/SyncClient';
import SyncContext from './sync/SyncContext';

export default function MapApp({ syncToken }: { syncToken: SyncToken }) {
  useGlobalKeyboardShortcuts();
  const [baseIsLoading, setBaseIsLoading] = useState(true);

  const [syncClient, setSyncClient] = useState<SyncClient | null>(null);
  useEffect(() => {
    const client = new SyncClient(syncToken);
    setSyncClient(client);
    return () => client.destroy();
  }, [syncToken]);

  return (
    <div className="map-app">
      {syncClient && (
        <SyncContext.Provider value={syncClient}>
          <BaseMap isLoading={setBaseIsLoading} />
          <Attribution />
          <LoadingIndicator isLoading={baseIsLoading} />

          <Sidebar />

          <Controls />

          <Flash />
        </SyncContext.Provider>
      )}
    </div>
  );
}
