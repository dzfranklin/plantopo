'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';
import { QueryClient, QueryClientProvider } from 'react-query';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <SpectrumProvider
            theme={defaultSpectrumTheme}
            // Set render consistently on the server so Next.js can
            // rehydrate. Is there a better way to do this?
            locale="en-US"
            scale="medium"
          >
            <div id="root">{children}</div>
          </SpectrumProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
