import { Dispatch, SetStateAction } from 'react';
import { ClusterData, MunroList } from './report';
import { JourneysComponent } from './JourneysComponent';
import { scoreCluster } from './ranking';
import { useDebugMode } from '@/hooks/debugMode';
import JSONView from '@/components/JSONView';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { ClusterImages } from './ClusterImages';

export function ClusterComponent({
  cluster,
  i,
  isExpanded,
  setIsExpanded,
  munros,
  from,
}: {
  cluster: ClusterData;
  i: number;
  isExpanded: boolean;
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
  munros: MunroList;
  from: [number, number];
}) {
  const debugMode = useDebugMode();

  const clusterMunros = munros.features
    .filter((f) => cluster.to.munros.includes(f.id))
    .sort((a, b) => {
      const aScore = cluster.to.popularityA[a.id] ?? 0;
      const bScore = cluster.to.popularityA[b.id] ?? 0;
      return bScore - aScore;
    });

  return (
    <div>
      <button
        onClick={() => setIsExpanded((p) => !p)}
        title="Expand"
        className="flex text-left items-baseline whitespace-pre-wrap w-full max-w-full"
      >
        <span className="mr-2 text-sm text-gray-500">{i + 1}</span>
        <span className="shrink truncate">
          {sentenceStartClusterName(cluster.to.name)} for{' '}
          {munroNames(clusterMunros)}
        </span>
        <div className="ml-auto">
          <ChevronRightIcon className="w-4" />
        </div>
      </button>
      {isExpanded && (
        <div className="mt-4">
          {debugMode && (
            <JSONView
              data={{ to: cluster.to, score: scoreCluster(cluster) }}
              collapsed={true}
            />
          )}

          <ClusterImages munros={clusterMunros} />

          <JourneysComponent
            dir="out"
            from={from}
            to={cluster.to}
            journeys={cluster.journeys.out}
          />
          <JourneysComponent
            dir="back"
            from={from}
            to={cluster.to}
            journeys={cluster.journeys.back}
          />
        </div>
      )}
    </div>
  );
}

function sentenceStartClusterName(v: string): string {
  if (v.startsWith('near ')) {
    return v.replace(/near /g, 'Near ');
  }
  return v;
}

function munroNames(munros: MunroList['features']): string {
  switch (munros.length) {
    case 0:
      return '';
    case 1:
      return munroName(munros[0]!);
    case 2:
      return `${munroName(munros[0]!)} and ${munroName(munros[1]!)}`;
    default:
      return `${munros.slice(0, -1).map(munroName).join(', ')}, and ${munroName(munros.at(-1)!)}`;
  }
}

function munroName(munro: MunroList['features'][number]): string {
  if (!munro.properties.name.includes(' [')) {
    return munro.properties.name;
  } else {
    return munro.properties.name.replace(/\s*\[.*?\]\s*/, '');
  }
}
