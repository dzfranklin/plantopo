'use client';

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import ErrorTechInfo from './ErrorTechInfo';
import { ErrorInfo } from 'react';
import { XCircleIcon } from '@heroicons/react/20/solid';

export default function fallbackRender({ error }: { error: unknown }) {
  return (
    <div className="max-w-2xl p-4 mx-auto mt-12 rounded-md bg-red-50">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="w-5 h-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Critical error</h3>
          <div className="my-2 text-sm text-red-700">
            <p>
              An unexpected error has occured. Please contact me at
              daniel@plantopo.com.
            </p>
          </div>
          <ErrorTechInfo error={error} />
        </div>
      </div>
    </div>
  );
}

function onError(error: unknown, _info: ErrorInfo) {
  if ('faro' in window) {
    console.log('pushing error to faro');
    try {
      (window.faro as any).api.pushError(error);
    } catch (e) {
      console.error('error boundary failed to push error to faro', e);
    }
  } else {
    console.error('error boundary cannot push error to faro as not loaded');
  }
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary fallbackRender={fallbackRender} onError={onError}>
      {children}
    </ReactErrorBoundary>
  );
}
