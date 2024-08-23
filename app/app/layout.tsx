import type { Metadata } from 'next';
import { UnitSettingsProvider } from '@/features/units/UnitSettingsProvider';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { DebugModeProvider } from '@/hooks/debugMode';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'PlanTopo',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white lg:bg-zinc-100 h-full max-h-full">
      <body className="h-full max-h-full">
        <Providers>
          <DebugModeProvider>
            <UnitSettingsProvider>
              <Toaster position="bottom-right" />
              {children}
            </UnitSettingsProvider>
          </DebugModeProvider>
        </Providers>
      </body>
    </html>
  );
}
