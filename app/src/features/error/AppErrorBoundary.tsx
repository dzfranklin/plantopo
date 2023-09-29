'use client';

import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import ErrorTechInfo from './ErrorTechInfo';
import { ErrorInfo } from 'react';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';

function fallbackRender({ error }: { error: unknown }) {
  return (
    <SpectrumProvider
      theme={defaultSpectrumTheme}
      // Set render consistently on the server so Next.js can
      // rehydrate. Is there a better way to do this?
      locale="en-US"
      scale="medium"
      minHeight="100vh"
    >
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
    </SpectrumProvider>
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
