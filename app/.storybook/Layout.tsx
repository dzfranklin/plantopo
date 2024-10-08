import '../app/globals.css';
import { ReactNode } from 'react';
import Providers from '../app/providers';
import { GeoipProvider } from '@/features/geoip/useGeoip';
import { GeoipData } from '@/features/geoip/schema';

const geoipValue: GeoipData = {
  country2: 'GB',
  countrySubdivision: 'SCT',
  city: 'Glasgow',
  point: [-4.2474, 55.8712],
};

export function Layout({ children }: { children: ReactNode }) {
  return (
    <Providers forceDebugModeAllowed={true}>
      <GeoipProvider value={geoipValue}>{children}</GeoipProvider>
    </Providers>
  );
}
