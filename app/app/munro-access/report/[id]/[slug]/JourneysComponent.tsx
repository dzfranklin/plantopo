'use client';
import { useMemo, useState } from 'react';
import { ClusterData, ItineraryData, JourneyData } from './report';
import { itineraryHour, OTPDuration, OTPTime } from './time';
import { hourColor } from './color';

export function JourneysComponent({
  dir,
  journeys,
  from,
  to,
}: {
  dir: 'out' | 'back';
  journeys: JourneyData;
  from: [number, number];
  to: ClusterData['to'];
}) {
  if (journeys.routingErrors.length > 0) {
    return (
      <div>
        no route {dir}: {journeys.messageStrings.join(' ')}
      </div>
    );
  }
  return (
    <div>
      <p className="text-base font-semibold leading-7 text-indigo-700 mt-4 mb-2">
        {dir === 'out' ? 'Out' : 'Back'}{' '}
      </p>

      <ul>
        {journeys.itineraries.map((itinerary, i) => (
          <li key={i} className="mb-1">
            <ItineraryComponent
              from={from}
              to={to}
              itinerary={itinerary}
              dir={dir}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItineraryComponent({
  dir,
  from,
  to,
  itinerary,
}: {
  dir: 'out' | 'back';
  from: [number, number];
  to: ClusterData['to'];
  itinerary: ItineraryData;
}) {
  const [expanded, setExpanded] = useState(false);

  const color = useMemo(() => {
    const h = itineraryHour(itinerary);
    return h ? hourColor(h) : '#FFF';
  }, [itinerary]);

  const googleMapsHref = googleMapsURL(
    dir === 'out' ? from : to.point,
    dir === 'out' ? to.point : from,
  );

  return (
    <div className="mb-0.5">
      <span className="flex gap-2 text-gray-600">
        <span
          className="aspect-1 rounded-full w-1 mr-0.5 my-1"
          style={{ backgroundColor: color }}
        ></span>
        <span>
          <OTPTime>{itinerary.startTime}</OTPTime> -{' '}
          <OTPTime>{itinerary.endTime}</OTPTime>
        </span>
        <span className="font-medium">
          <OTPDuration>{itinerary.duration}</OTPDuration>
        </span>
        <button onClick={() => setExpanded((p) => !p)} className="underline">
          {itinerary.legs.length} steps
        </button>
        <a href={googleMapsHref} className="underline hidden md:inline">
          Google Maps (today)
        </a>
      </span>
      {expanded && (
        <div className="mt-2 mb-4">
          <ul className="list-decimal list-inside">
            {itinerary.legs.map((leg, i) => (
              <li key={i} className="mb-1.5">
                <span>
                  {leg.headsign && leg.headsign + ' '}
                  {leg.interlineWithPreviousLeg && ' (interline)'}
                </span>
                <span>
                  {leg.from.name} <OTPTime>{leg.startTime}</OTPTime> to{' '}
                  {leg.to.name} <OTPTime>{leg.endTime}</OTPTime> via {leg.mode}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function googleMapsURL(
  origin: [number, number],
  destination: [number, number],
) {
  const params = new URLSearchParams({
    api: '1',
    origin: origin[1] + ',' + origin[0],
    destination: destination[1] + ',' + destination[0],
    travelmode: 'transit',
  });
  return 'https://www.google.com/maps/dir/?' + params.toString();
}
