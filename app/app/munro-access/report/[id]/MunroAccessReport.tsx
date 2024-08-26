'use client';

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createEventSource } from 'eventsource-client';
import { ClusterData, MunroList, ReportData, reportDataSchema } from './report';
import { ClusterComponent } from './ClusterComponent';
import { ReportMapComponent } from './ReportMapComponent';
import {
  ClusterScoreFeatures,
  clusterScoreFeaturesSchema,
  defaultClusterWeights,
  scoreCluster,
  weighClusterScores,
} from './ranking';
import { useDebugMode } from '@/hooks/debugMode';
import { Button } from '@/components/button';
import Skeleton from '@/components/Skeleton';
import { Layout } from '@/components/Layout';
import { paths } from '@/api/v1';
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINT } from '@/env';
import { DateTime } from 'luxon';

/* TODO:
  - Is the start time too early in practice if we aren't fetching later pages?
  - how can I precheck there are any stops within range of the input?
  - Also display by munro rather than by cluster
*/

type ReportStatus =
  paths['/munro-access/report/{id}/status']['get']['responses']['200']['content']['application/json'];

export function MunroAccessReportLoader({
  id,
  munros,
  initialStatus,
}: {
  id: string;
  munros: MunroList;
  initialStatus: ReportStatus;
}) {
  const [status, setStatus] = useState(initialStatus);

  const isReady = status.status === 'ready';
  useEffect(() => {
    if (isReady) return;
    console.log('subscribing to status updates');
    const events = createEventSource({
      url: API_ENDPOINT + `munro-access/report/${id}/status-updates`,
      onMessage: ({ data, event }) => {
        if (event === 'status') {
          setStatus((p) => (p.status === 'ready' ? p : JSON.parse(data)));
        }
      },
      onConnect: () => console.log('connected'),
      onDisconnect: () => console.log('disconnected'),
      onScheduleReconnect: ({ delay }) =>
        console.log(`disconnected, retrying after ${delay}ms`),
    });
    return () => events.close();
  }, [id, isReady]);

  const report = useQuery({
    queryKey: [status.report.url],
    queryFn: async () =>
      reportDataSchema.parse(await (await fetch(status.report.url!)).json()),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!status.report.url,
  });

  if (report.error) {
    throw report.error;
  }

  const [formattedDate, setFormattedDate] = useState(
    DateTime.fromISO(status.report.date).toISODate(),
  );
  useEffect(() => {
    setFormattedDate(
      DateTime.fromISO(status.report.date).toLocaleString(DateTime.DATE_FULL),
    );
  }, [status.report.date]);
  const title = `Munro access report for ${status.report.fromLabel} on ${formattedDate}`;

  if (status.status !== 'ready') {
    return (
      <Layout pageTitle={title} wide={true}>
        <ReportGeneratingComponent />
      </Layout>
    );
  } else if (!report.data) {
    return (
      <Layout pageTitle={title} wide={true}>
        <Skeleton />
      </Layout>
    );
  } else {
    return (
      <Layout pageTitle={title} wide={true}>
        <MunroAccessReport report={report.data} munros={munros} />
      </Layout>
    );
  }
}

function ReportGeneratingComponent() {
  return <div>TODO</div>;
}

function MunroAccessReport({
  report,
  munros,
}: {
  report: ReportData;
  munros: MunroList;
}) {
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);
  const debugMode = useDebugMode();
  const [weights, setWeights] = useState(defaultClusterWeights);

  const rankedClusters = useMemo(() => {
    const scores = weighClusterScores(
      report.clusters.map(scoreCluster),
      weights,
    );
    return report.clusters
      .map((v, i): [ClusterData, number] => [v, i])
      .filter(([v, _]) => scoreCluster(v) !== undefined)
      .sort(([aV, aI], [bV, bI]) => {
        const aS = scores[aI]!;
        const bS = scores[bI]!;
        if (aS === bS) {
          return aV.to.id - bV.to.id;
        } else {
          return bS - aS;
        }
      })
      .map(([v]) => v);
  }, [report, weights]);

  return (
    <div className="space-y-6">
      <p>TODO time generated</p>

      <ShortCredit />

      {debugMode && (
        <DebugWeightControl value={weights} setValue={setWeights} />
      )}

      <div className="grid gap-5 lg:gap-10 grid-rows-[400px_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] overflow-x-clip">
        <div className="lg:relative lg:col-start-2 lg:row-start-1">
          <ReportMapComponent
            report={report}
            munros={munros}
            expandedCluster={expandedCluster}
          />
        </div>
        <ul className="lg:col-start-1 lg:row-start-1 max-h-full max-w-full w-full overflow-y-auto overflow-x-clip">
          {rankedClusters.map((cluster, i) => (
            <li
              key={cluster.to.id}
              className="mb-2 py-2 border-b w-full max-w-full overflow-x-clip"
            >
              <ClusterComponent
                cluster={cluster}
                i={i}
                munros={munros}
                isExpanded={cluster.to.id === expandedCluster}
                setIsExpanded={(arg) => {
                  const v =
                    typeof arg === 'function'
                      ? arg(cluster.to.id === expandedCluster)
                      : arg;
                  setExpandedCluster(v ? cluster.to.id : null);
                }}
                from={report.from}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ShortCredit() {
  return (
    <div className="text-sm">
      This project relies on information from{' '}
      <a href="https://www.walkhighlands.co.uk/munros/" className="link">
        Walkhighlands
      </a>
      ,{' '}
      <a href="https://osdatahub.os.uk/" className="link">
        Ordnance Survey
      </a>
      ,{' '}
      <a href="https://www.openstreetmap.org" className="link">
        OpenStreetMap
      </a>
      ,{' '}
      <a href="https://data.bus-data.dft.gov.uk/" className="link">
        Department for Transit
      </a>
      ,{' '}
      <a href="https://opendata.nationalrail.co.uk" className="link">
        National Rail
      </a>
      ,{' '}
      <a href="https://www.hills-database.co.uk/" className="link">
        The Database of British and Irish Hills
      </a>
      , and{' '}
      <a href="https://www.geograph.org.uk" className="link">
        Geograph
      </a>
      , code from{' '}
      <a href="https://www.opentripplanner.org/" className="link">
        OpenTripPlanner
      </a>
      , and{' '}
      <a href="/credits" className="link">
        others
      </a>
      .
    </div>
  );
}

function DebugWeightControl({
  value,
  setValue,
}: {
  value: ClusterScoreFeatures;
  setValue: Dispatch<SetStateAction<ClusterScoreFeatures>>;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.value = JSON.stringify(value, null, 2);
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      <textarea
        defaultValue={JSON.stringify(value, null, 2)}
        ref={inputRef}
        rows={6}
      ></textarea>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <Button
        color="secondary"
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(input.value);
          } catch (err) {
            setErr(`${err}`);
            return;
          }

          const res = clusterScoreFeaturesSchema.safeParse(parsed);
          if (res.error) {
            setErr(res.error.toString());
            return;
          }

          setValue(res.data);
        }}
      >
        Update
      </Button>
    </div>
  );
}
