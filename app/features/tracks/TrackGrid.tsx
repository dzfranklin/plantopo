import TrackPreview, {
  TrackPreviewSkeleton,
} from '@/features/tracks/TrackPreview';
import Link from 'next/link';
import Skeleton from '@/components/Skeleton';
import { TrackSummary } from '@/features/tracks/schema';
import { Timestamp } from '@/components/Timestamp';
import { DateTime } from 'luxon';
import { useInfiniteTracksQuery } from '@/features/tracks/queries';
import { CSSProperties, useMemo } from 'react';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useRouter } from 'next/navigation';
import InfiniteLoader from 'react-window-infinite-loader';

// TODO: Save and restore scroll state using session storage

export function TrackGrid() {
  return (
    <AutoSizer>
      {({ width, height }) => <SizedTrackGrid width={width} height={height} />}
    </AutoSizer>
  );
}

const itemHeight = 180;
const itemWidth = 240;
const rowPadding = 30;
const colPadding = 30;

function SizedTrackGrid({ width, height }: { width: number; height: number }) {
  const cols = Math.max(1, Math.floor(width / (itemWidth + colPadding)));

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetched } =
    useInfiniteTracksQuery({
      perPage: 99, // evenly divisible by the number of columns we use at each viewport size
    });

  const rows = useMemo(() => {
    const items: TrackSummary[] = [];
    for (const page of data?.pages ?? []) {
      if (page.data) {
        items.push(...page.data.tracks);
      }
    }

    const rows: TrackSummary[][] = [];

    let i = 0;
    for (; i + cols < items.length; i += cols) {
      const row: TrackSummary[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(items[i + c]!);
      }
      rows.push(row);
    }

    if (i < items.length) {
      const row: TrackSummary[] = [];
      for (; i < items.length; i++) {
        row.push(items[i]!);
      }
      rows.push(row);
    }

    return rows;
  }, [data?.pages, cols]);

  // If there are more items to be loaded then add an extra row to hold a loading indicator.
  const rowCount = hasNextPage ? rows.length + 1 : rows.length;

  // Disable loading if we are already fetching the next page
  const loadMoreItems = isFetchingNextPage ? () => {} : () => fetchNextPage();

  // Every row is loaded except for our loading indicator row.
  const isRowLoaded = (idx: number) => !hasNextPage || idx < rows.length;

  if (!isFetched) {
    return <Skeleton />;
  }

  return (
    <InfiniteLoader
      isItemLoaded={isRowLoaded}
      itemCount={rowCount}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <VariableSizeList
          itemSize={() => itemHeight + rowPadding}
          itemCount={rowCount}
          width={width}
          height={height}
          itemData={rows}
          useIsScrolling
          onItemsRendered={onItemsRendered}
          ref={ref}
        >
          {Row}
        </VariableSizeList>
      )}
    </InfiniteLoader>
  );
}

function Row({
  index,
  isScrolling,
  style,
  data,
}: {
  index: number;
  isScrolling?: boolean;
  style: CSSProperties;
  data: TrackSummary[][];
}) {
  if (index === data.length) {
    return (
      <div style={style}>
        <LoadingRow />
      </div>
    );
  }

  const row = data[index]!;

  return (
    <div style={style}>
      <div className="h-full max-h-full" style={{ paddingBottom: rowPadding }}>
        <div className="flex h-full max-h-full" style={{ gap: colPadding }}>
          {row.map((track) => (
            <div
              key={track.id}
              style={{ width: itemWidth }}
              className="h-full max-h-full"
            >
              <TrackItem track={track} isScrolling={isScrolling ?? false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackItem({
  track,
  isScrolling,
}: {
  track: TrackSummary;
  isScrolling: boolean;
}) {
  const router = useRouter();
  const href = '/tracks/' + track.id;
  return (
    <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_max-content] h-full max-h-full mb-2">
      <div
        onClick={(evt) => {
          evt.preventDefault();
          router.push(href);
        }}
        className="cursor-pointer h-full max-h-full"
      >
        <div className="h-full max-h-full pointer-events-none clip rounded-lg">
          {isScrolling ? (
            <TrackPreviewSkeleton />
          ) : (
            <TrackPreview
              padding={10}
              polyline={track.simplifiedLine}
              className=""
            />
          )}
        </div>
      </div>

      <Link href={href}>
        <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">
          {track.name}
        </p>
        <p className="pointer-events-none block text-sm font-medium text-gray-500">
          <Timestamp iso={track.date} fmt={DateTime.DATETIME_MED} />
        </p>
      </Link>

      <span className="sr-only">View details for {track.name}</span>
    </div>
  );
}

function LoadingRow() {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
