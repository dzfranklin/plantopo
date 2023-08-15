'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SpectrumProvider
          theme={defaultSpectrumTheme}
          // Set render consistently on the server so Next.js can
          // rehydrate. Is there a better way to do this?
          locale="en-US"
          scale="medium"
        >
          {children}
        </SpectrumProvider>
      </body>
    </html>
  );
}
