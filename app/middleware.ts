import { NextRequest, NextResponse } from 'next/server';
import type { GeoipCookie } from '@/features/geoip/schema';

export function middleware(request: NextRequest): NextResponse {
  const country2 = request.headers.get('x-vercel-ip-country');
  const countrySubdivision = request.headers.get('x-vercel-ip-country-region');
  const rawCity = request.headers.get('x-vercel-ip-city');
  const rawLng = request.headers.get('x-vercel-ip-longitude');
  const rawLat = request.headers.get('x-vercel-ip-latitude');
  let geoipData: GeoipCookie | undefined;
  if (country2 && countrySubdivision && rawCity && rawLng && rawLat) {
    const city = decodeURIComponent(rawCity);
    const lng = parseFloat(rawLng);
    const lat = parseFloat(rawLat);
    if (!Number.isNaN(lng) && !Number.isNaN(lng)) {
      geoipData = { country2, countrySubdivision, city, point: [lng, lat] };
    }
  }

  const response = NextResponse.next();

  if (geoipData) {
    response.cookies.set('geoip', JSON.stringify(geoipData));
  }

  return response;
}
