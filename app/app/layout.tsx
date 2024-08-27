import type { Metadata } from 'next';
import './globals.css';
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
