'use client';

import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import ErrorTechInfo from './ErrorTechInfo';
import { ErrorInfo } from 'react';

function fallbackRender({ error }: { error: unknown }) {
  return (
    <DialogContainer isDismissable={false} onDismiss={() => {}}>
      <AlertDialog
        title="Error"
        variant="error"
        primaryActionLabel="Reload"
        onPrimaryAction={() => document.location.reload()}
      >
        <ErrorTechInfo error={error} />
      </AlertDialog>
    </DialogContainer>
  );
}

function onError(error: unknown, info: ErrorInfo) {
  console.error('error boundary caught', error, info);
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary fallbackRender={fallbackRender} onError={onError}>
      {children}
    </ReactErrorBoundary>
  );
}
