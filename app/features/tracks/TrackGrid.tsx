import TrackPreview from '@/features/tracks/TrackPreview';
import Link from 'next/link';
import Skeleton from '@/components/Skeleton';
import { TrackSummary } from '@/features/tracks/schema';
import { Timestamp } from '@/components/Timestamp';
import { DateTime } from 'luxon';
import { useTracksQuery } from '@/features/tracks/queries';
import { useRouter } from 'next/navigation';
import { Dispatch, SetStateAction, useCallback, useRef, useState } from 'react';
import * as Headless from '@headlessui/react';
import cls from '@/cls';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from '@heroicons/react/16/solid';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { range } from '@/array';
import { shallowEqualObjects } from 'shallow-equal';
import { z } from 'zod';

const optionsSchema = z.object({
  page: z.number().gte(1),
  perPage: z.number().gte(1).lte(100),
  orderBy: z.enum([
    'name',
    'dateAsc',
    'dateDesc',
    'dateUploadedAsc',
    'dateUploadedDesc',
  ]),
});

type Options = z.infer<typeof optionsSchema>;

type SetOptions = Dispatch<SetStateAction<Options>>;

const defaultOptions: Options = {
  page: 1,
  perPage: 50,
  orderBy: 'dateDesc',
};

const orderByLabels = [
  { text: 'Newest', id: 'dateDesc' },
  { text: 'Oldest', id: 'dateAsc' },
  { text: 'Most recently uploaded', id: 'dateUploadedDesc' },
  { text: 'Least recently uploaded', id: 'dateUploadedAsc' },
  { text: 'Name', id: 'name' },
] as const;

export function TrackGrid(params: {
  options?: string;
  setOptions?: (_: string) => void;
}) {
  const [options, _setOptions] = useState<Options>(() => {
    if (!params.options) return defaultOptions;
    try {
      return optionsSchema.parse(JSON.parse(params.options));
    } catch (err) {
      console.warn('failed to parse initialOptions', err);
      return defaultOptions;
    }
  });

  const { data } = useTracksQuery(options);

  const paramsSetOptionsRef = useRef<((_: string) => void) | undefined>(
    params.setOptions,
  );
  paramsSetOptionsRef.current = params.setOptions;
  const setOptions = useCallback(
    (value: SetStateAction<Options>) =>
      _setOptions((p) => {
        let resolved: Options;
        if (typeof value === 'function') {
          resolved = value(p);
        } else {
          resolved = value;
        }

        if (resolved.page === p.page && !shallowEqualObjects(resolved, p)) {
          resolved.page = 1;
        }

        paramsSetOptionsRef.current?.(JSON.stringify(resolved));

        // If the new query isn't cached then the page height resets to the window height while we show the skeleton so
        // the user is snapped to the top of the page. This keeps the behavior consistent if the new query is cached.
        window.scrollTo({ top: 0, behavior: 'instant' });

        return resolved;
      }),
    [],
  );

  if (!data) {
    return <Skeleton />;
  }

  return (
    <div>
      <div className="mb-6 pb-2 border-b border-gray-200">
        <TrackGridControls options={options} setOptions={setOptions} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-8">
        {data.tracks.map((track) => (
          <TrackItem track={track} key={track.id} />
        ))}
      </div>
      <div className="mt-6">
        <TrackGridPaginationControls
          options={options}
          setOptions={setOptions}
          page={data.page}
          pageSize={data.perPage}
          currentPageSize={data.tracks.length}
          pages={data.pages}
          total={data.total}
        />
      </div>
    </div>
  );
}

function TrackGridControls({
  options,
  setOptions,
}: {
  options: Options;
  setOptions: SetOptions;
}) {
  return (
    <div className="flex">
      <div className="ml-auto">
        <Headless.Menu as="div" className="relative inline-block text-left">
          <div>
            <Headless.MenuButton className="group inline-flex justify-center text-sm font-medium text-gray-700 hover:text-gray-900">
              Sort
              <ChevronDownIcon
                aria-hidden="true"
                className="-mr-1 ml-1 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
              />
            </Headless.MenuButton>
          </div>

          <Headless.MenuItems
            transition
            className="absolute right-0 z-[1010] mt-2 w-56 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
          >
            {orderByLabels.map((option) => (
              <Headless.MenuItem key={option.id}>
                <button
                  onClick={() =>
                    setOptions((p) => ({ ...p, orderBy: option.id }))
                  }
                  className={cls(
                    option.id === options.orderBy
                      ? 'font-medium text-gray-900'
                      : 'text-gray-500',
                    'block w-full px-4 py-2 text-sm data-[focus]:bg-gray-100 text-left',
                  )}
                >
                  {option.text}
                </button>
              </Headless.MenuItem>
            ))}
          </Headless.MenuItems>
        </Headless.Menu>
      </div>
    </div>
  );
}

function TrackGridPaginationControls({
  options,
  setOptions,
  page,
  pageSize,
  currentPageSize,
  pages,
  total,
}: {
  options: Options;
  setOptions: SetOptions;
  page: number;
  pageSize: number;
  currentPageSize: number;
  pages: number;
  total: number;
}) {
  const maxPagesShown = 6; // must be divisible by 2

  let dotPosition: 'none' | 'middle' | 'sides';
  if (pages <= maxPagesShown) {
    dotPosition = 'none';
  } else if (
    page <= maxPagesShown / 2 ||
    page >= pages - maxPagesShown / 2 + 1
  ) {
    dotPosition = 'middle';
  } else {
    dotPosition = 'sides';
  }

  return (
    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-gray-700">
          Showing{' '}
          <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
          <span className="font-medium">
            {(page - 1) * pageSize + currentPageSize}
          </span>{' '}
          of <span className="font-medium">{total}</span> results
        </p>
      </div>
      <div>
        <nav
          aria-label="Pagination"
          className="isolate inline-flex -space-x-px rounded-md shadow-sm"
        >
          <button
            disabled={options.page === 1}
            onClick={() => setOptions((p) => ({ ...p, page: 1 }))}
            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 disabled:text-gray-200 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
          >
            <span className="sr-only">First</span>
            <ChevronDoubleLeftIcon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            disabled={options.page === 1}
            onClick={() =>
              setOptions((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
            }
            className="relative inline-flex items-center px-2 py-2 text-gray-400 disabled:text-gray-200 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeftIcon aria-hidden="true" className="h-5 w-5" />
          </button>

          {dotPosition === 'none' &&
            range(1, pages + 1).map((n) => (
              <PaginationControlPageNumber
                key={n}
                page={n}
                isCurrent={n === page}
                setOptions={setOptions}
              />
            ))}

          {dotPosition === 'middle' && (
            <>
              {range(1, maxPagesShown / 2 + 1).map((n) => (
                <PaginationControlPageNumber
                  key={n}
                  page={n}
                  isCurrent={n === page}
                  setOptions={setOptions}
                />
              ))}
              <PaginationControlDots />
              {range(pages - maxPagesShown / 2 + 1, pages + 1).map((n) => (
                <PaginationControlPageNumber
                  key={n}
                  page={n}
                  isCurrent={n === page}
                  setOptions={setOptions}
                />
              ))}
            </>
          )}

          {dotPosition === 'sides' && (
            <>
              <PaginationControlDots />
              {range(page - 1, page + 2).map((n) => (
                <PaginationControlPageNumber
                  key={n}
                  page={n}
                  isCurrent={n === page}
                  setOptions={setOptions}
                />
              ))}
              <PaginationControlDots />
            </>
          )}

          <button
            disabled={options.page === pages}
            onClick={() =>
              setOptions((p) => ({ ...p, page: Math.min(pages, p.page + 1) }))
            }
            className="relative inline-flex items-center px-2 py-2 text-gray-400 disabled:text-gray-200 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
          >
            <span className="sr-only">Next</span>
            <ChevronRightIcon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            disabled={options.page === pages}
            onClick={() => setOptions((p) => ({ ...p, page: pages }))}
            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 disabled:text-gray-200 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
          >
            <span className="sr-only">Next</span>
            <ChevronDoubleRightIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </div>
  );
}

function PaginationControlDots() {
  return (
    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
      ...
    </span>
  );
}

function PaginationControlPageNumber({
  page,
  isCurrent,
  setOptions,
}: {
  page: number;
  isCurrent: boolean;
  setOptions: SetOptions;
}) {
  return (
    <button
      onClick={() => setOptions((p) => ({ ...p, page: page }))}
      aria-current="page"
      className={cls(
        'relative inline-flex items-center px-4 py-2 text-sm font-semibold',
        isCurrent
          ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0',
      )}
    >
      {page}
    </button>
  );
}

function TrackItem({ track }: { track: TrackSummary }) {
  const router = useRouter();
  const href = '/tracks/' + track.id;
  return (
    <div className="aspect-[4/3] grid grid-cols-1 grid-rows-[minmax(0,1fr)_max-content] mb-2">
      <div
        onClick={(evt) => {
          evt.preventDefault();
          router.push(href);
        }}
        className="cursor-pointer h-full max-h-full"
      >
        <div className="w-full max-w-full h-full max-h-full pointer-events-none clip rounded-lg">
          <TrackPreview
            padding={10}
            polyline={track.simplifiedLine}
            className=""
          />
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
