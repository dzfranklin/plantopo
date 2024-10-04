import { NextRequest, NextResponse } from 'next/server';
import type { GeoipCookie } from '@/features/geoip/schema';

export function middleware(request: NextRequest): NextResponse {
  const country2 = request.headers.get('x-vercel-ip-country');
  const countrySubdivision2 = request.headers.get('x-vercel-ip-country-region');
  const city = request.headers.get('x-vercel-ip-city');
  const lngS = request.headers.get('x-vercel-ip-longitude');
  const latS = request.headers.get('x-vercel-ip-latitude');
  let geoipData: GeoipCookie | undefined;
  if (country2 && countrySubdivision2 && city && lngS && latS) {
    const lng = parseFloat(lngS);
    const lat = parseFloat(latS);
    if (!Number.isNaN(lng) && !Number.isNaN(lng)) {
      geoipData = { country2, countrySubdivision2, city, point: [lng, lat] };
    }
  }

  const response = NextResponse.next();

  if (geoipData) {
    response.cookies.set('geoip', JSON.stringify(geoipData));
  }

  return response;
}
