import { DateTime, Duration } from 'luxon';
import prettyMilliseconds from 'pretty-ms';
import { timeColorScale } from './color';
import { ItineraryData } from './report';

export function otpTime(v: number): DateTime {
  return DateTime.fromMillis(v).setZone('Europe/London').toUTC();
}

export function OTPTime({ children }: { children: number }) {
  return otpTime(children).toLocaleString(DateTime.TIME_SIMPLE);
}

export function OTPDuration({ children }: { children: number }) {
  const rounded = Math.round(children / 60) * 60;
  return prettyMilliseconds(rounded * 1000, {});
}

export function itineraryHour(itinerary: ItineraryData): number | undefined {
  const t = itinerary.legs[0]?.startTime;
  if (!t) return;
  const h = otpTime(t).hour;
  if (!Object.hasOwn(timeColorScale, h.toString())) {
    console.warn('missing color for hour', h);
  }
  return h;
}

export function itineraryDuration(itinerary: ItineraryData): Duration {
  return Duration.fromMillis(itinerary.duration * 1000);
}
