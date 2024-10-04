import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { type GeoipData } from '@/features/geoip/schema';
import { headers } from 'next/headers';
import { GeoipProvider } from '@/features/geoip/useGeoip';

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
        <GeoipProvider value={readGeoipHeaders()}>
          <Providers>{children}</Providers>
        </GeoipProvider>
      </body>
    </html>
  );
}

function readGeoipHeaders(): GeoipData | null {
  const hs = headers();

  const country2 = hs.get('x-vercel-ip-country');
  const countrySubdivision = hs.get('x-vercel-ip-country-region');
  const rawCity = hs.get('x-vercel-ip-city');
  const rawLng = hs.get('x-vercel-ip-longitude');
  const rawLat = hs.get('x-vercel-ip-latitude');
  if (country2 && countrySubdivision && rawCity && rawLng && rawLat) {
    const city = decodeURIComponent(rawCity);
    const lng = parseFloat(rawLng);
    const lat = parseFloat(rawLat);
    if (!Number.isNaN(lng) && !Number.isNaN(lng)) {
      return { country2, countrySubdivision, city, point: [lng, lat] };
    }
  }
  return null;
}
