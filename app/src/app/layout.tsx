'use client';

import '../globals.css';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppErrorBoundary } from '@/features/error/AppErrorBoundary';
import { FaroSDK } from '@/features/FaroSDK';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>PlanTopo</title>
      </head>
      <body>
        <RootLayout>{children}</RootLayout>
      </body>
    </html>
  );
}

export function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log(
      `Running PlanTopo version ${
        process.env.NEXT_PUBLIC_PT_VER ?? '<unspecified>'
      }`,
    );
  });

  const queryClient = new QueryClient();
  const router = useRouter();

  return (
    <AppErrorBoundary>
      <FaroSDK />
      <QueryClientProvider client={queryClient}>
        <SpectrumProvider
          theme={defaultSpectrumTheme}
          router={{ navigate: router.push }}
          // Set render consistently on the server so Next.js can
          // rehydrate. Is there a better way to do this?
          locale="en-US"
          scale="medium"
          colorScheme="light"
          minHeight="100vh"
        >
          {children}
          <div id="portal-container" className="z-[60]"></div>
          <ReactQueryDevtools initialIsOpen={false} />
        </SpectrumProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
