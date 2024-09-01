'use client';

import {
  ClusterData,
  MunroList,
  ReportData,
} from '@/app/munro-access/report/[id]/[slug]/report';
import { useMemo, useState } from 'react';
import { useDebugMode } from '@/hooks/debugMode';
import {
  defaultClusterWeights,
  scoreCluster,
  weighClusterScores,
} from '@/app/munro-access/report/[id]/[slug]/ranking';
import { ShortCredit } from '@/app/munro-access/report/[id]/[slug]/ShortCredit';
import { DebugWeightControl } from '@/app/munro-access/report/[id]/[slug]/DebugWeightControl';
import { ReportMapComponent } from '@/app/munro-access/report/[id]/[slug]/ReportMapComponent';
import { ClusterComponent } from '@/app/munro-access/report/[id]/[slug]/ClusterComponent';
import { Timestamp } from '@/components/Timestamp';
import { DateTime } from 'luxon';

export function MunroAccessReport({
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
      {report.generatedAt && (
        <p className="-mt-6 mb-6 text-xs text-gray-600">
          Generated{' '}
          <Timestamp iso={report.generatedAt} fmt={DateTime.DATETIME_FULL} />
        </p>
      )}

      <ShortCredit />

      {debugMode && (
        <DebugWeightControl value={weights} setValue={setWeights} />
      )}

      <div className="grid gap-5 lg:gap-10 grid-rows-[33vh_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] overflow-x-clip">
        <div className="lg:relative lg:col-start-2 lg:row-start-1 mx-8 md:mx-0">
          <ReportMapComponent
            report={report}
            munros={munros}
            expandedCluster={expandedCluster}
            setExpandedCluster={setExpandedCluster}
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
