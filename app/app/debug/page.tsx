'use client';

import { Button } from '@/components/button';
import {
  allowDebugMode,
  forbidDebugMode,
  useDebugMode,
  useIsDebugModeAllowed,
} from '@/hooks/debugMode';
import JSONView from '@/components/JSONView';
import { useGeoip } from '@/features/geoip/useGeoip';

export default function Page() {
  const debugMode = useDebugMode();
  const isDebugAllowed = useIsDebugModeAllowed();
  const geoip = useGeoip();
  return (
    <div className="m-10 space-y-4">
      <div>
        <p className="font-semibold mb-4">Debug mode</p>
        Debug mode is {isDebugAllowed ? 'allowed' : 'not allowed'} and{' '}
        {debugMode ? 'enabled' : 'disabled'}.
        <Button
          className="ml-4"
          onClick={() => {
            isDebugAllowed ? forbidDebugMode() : allowDebugMode();
            location.reload();
          }}
        >
          {isDebugAllowed ? 'Forbid debug mode' : 'Allow debug mode'}
        </Button>
      </div>

      <div>
        <p className="font-semibold mb-2">Geoip</p>
        <JSONView data={geoip} />
      </div>
    </div>
  );
}
