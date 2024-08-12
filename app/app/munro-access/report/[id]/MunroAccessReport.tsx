'use client';

import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  JourneyData,
  ReportData,
  ClusterData,
  reportDataSchema,
  itineraryData,
} from './report';
import prettyMilliseconds from 'pretty-ms';
import { DateTime } from 'luxon';

/* TODO:
  - Is the start time too early in practice if we aren't fetching later pages?
  - how can I precheck there are any stops within range of the input?
  - Also display by munro rather than by cluster
*/

async function fetchReport(
  url: string,
): Promise<{ data: ReportData } | { error: unknown }> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 404) {
        notFound();
      } else {
        throw new Error('report server issue');
      }
    }

    const json = await resp.json();
    const data = reportDataSchema.parse(json);
    return { data };
  } catch (error) {
    return { error };
  }
}

export function MunroAccessReportLoader({ reportURL }: { reportURL: string }) {
  const [result, setResult] = useState<
    { data: ReportData } | { error: unknown } | null
  >(null);
  useEffect(() => {
    fetchReport(reportURL).then(setResult);
  }, [reportURL]);

  if (result && 'error' in result) {
    if (result.error === 'not-found') {
      notFound();
    } else {
      throw result.error;
    }
  }

  if (result === null) {
    return <div>Loading...</div>;
  }

  return <MunroAccessReport report={result.data} />;
}

export function MunroAccessReport({ report }: { report: ReportData }) {
  return (
    <div className="space-y-4">
      <div>
        {report.from.join(', ')} {report.date}
      </div>
      <div>TODO: Data credit</div>
      <ul>
        {report.clusters.slice(0, 7).map((cluster, i) => (
          <li key={i}>
            <ClusterComponent cluster={cluster} i={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClusterComponent({ cluster, i }: { cluster: ClusterData; i: number }) {
  return (
    <div className="border-b">
      <span className="mr-1">{i + 1}</span>
      <span>{cluster.to.munros.join(', ')}</span>
      <span>{JSON.stringify(cluster.to)}</span>
      <JourneysComponent dir="out" journeys={cluster.journeys.out} />
      <JourneysComponent dir="back" journeys={cluster.journeys.back} />
    </div>
  );
}

function JourneysComponent({
  dir,
  journeys,
}: {
  dir: 'out' | 'back';
  journeys: JourneyData;
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
      <div>{dir === 'out' ? 'Out' : 'Back'}</div>
      <ul>
        {journeys.itineraries.map((itinerary, i) => (
          <li key={i}>
            <ItineraryComponent itinerary={itinerary} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItineraryComponent({ itinerary }: { itinerary: itineraryData }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <span className="flex gap-1">
        <span>
          <OTPTime>{itinerary.startTime}</OTPTime> -{' '}
          <OTPTime>{itinerary.endTime}</OTPTime>
        </span>
        <span>
          <OTPDuration>{itinerary.duration}</OTPDuration>
        </span>
        <button onClick={() => setExpanded((p) => !p)}>
          {itinerary.legs.length} steps
        </button>
      </span>
      {expanded && (
        <div>
          <ul>
            {itinerary.legs.map((leg, i) => (
              <li key={i}>
                <span>
                  {leg.from.name} <OTPTime>{leg.startTime}</OTPTime> to{' '}
                  {leg.to.name} <OTPTime>{leg.endTime}</OTPTime> via {leg.mode}
                  {leg.headsign && ' ' + leg.headsign}
                  {leg.interlineWithPreviousLeg && ' (interline)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OTPTime({ children }: { children: number }) {
  const d = DateTime.fromMillis(children).setZone('Europe/London').toUTC();
  return d.toLocaleString(DateTime.TIME_SIMPLE);
}

function OTPDuration({ children }: { children: number }) {
  const rounded = Math.round(children / 60) * 60;
  return prettyMilliseconds(rounded * 1000, {});
}
