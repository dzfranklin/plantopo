'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cls from './cls';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  return (
    <html lang="en" className="min-h-full">
      <head>
        <title>PlanTopo</title>
      </head>
      <body className={cls(inter.className, 'min-h-full')}>
        <QueryClientProvider client={queryClient}>
          <SpectrumProvider
            theme={defaultSpectrumTheme}
            // Set render consistently on the server so Next.js can
            // rehydrate. Is there a better way to do this?
            locale="en-US"
            scale="medium"
            minHeight="100vh"
          >
            {children}
            <div id="portal-container" className="z-[60]"></div>
            <ReactQueryDevtools initialIsOpen={false} />
          </SpectrumProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
