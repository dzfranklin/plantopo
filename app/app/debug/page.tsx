'use client';

import { Button } from '@/components/button';
import {
  allowDebugMode,
  forbidDebugMode,
  useDebugMode,
  useIsDebugModeAllowed,
} from '@/hooks/debugMode';

export default function Page() {
  const debugMode = useDebugMode();
  const isDebugAllowed = useIsDebugModeAllowed();
  return (
    <div className="m-10">
      <p>
        Debug mode is {isDebugAllowed ? 'allowed' : 'not allowed'} and{' '}
        {debugMode ? 'enabled' : 'disabled'}
      </p>
      <Button
        onClick={() => {
          isDebugAllowed ? forbidDebugMode() : allowDebugMode();
          location.reload();
        }}
      >
        {isDebugAllowed ? 'Forbid debug mode' : 'Allow debug mode'}
      </Button>
    </div>
  );
}
