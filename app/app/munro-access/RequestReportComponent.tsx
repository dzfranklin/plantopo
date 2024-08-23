'use client';

import { Button } from '@/components/button';
import { MAPBOX_TOKEN } from '@/env';
import { AddressMinimap, SearchBox } from '@mapbox/search-js-react';
import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { $api } from '@/api/client';
import { useRouter } from 'next/navigation';

const datetimeLocalFmt = "yyyy-MM-dd'T'HH:mm";

export default function RequestReportComponent() {
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [from, setFrom] = useState<{
    label: string;
    point: [number, number];
  } | null>(null);

  const [times, setTimes] = useState<{
    default: string;
    min: string;
    max: string;
  } | null>(null);
  useEffect(() => {
    const currentTime = DateTime.now();
    const currentDate = currentTime.set({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const fmt = (t: DateTime) => t.toFormat(datetimeLocalFmt);
    setTimes({
      default: fmt(currentTime),
      min: fmt(currentDate.minus({ day: 14 })),
      max: fmt(currentDate.plus({ month: 3 }).set({ hour: 23, minute: 59 })),
    });
  }, []);

  const router = useRouter();

  const mutation = $api.useMutation('post', '/munro-access/request', {
    onSuccess: ({ id }) => router.push('/munro-access/report/' + id),
  });
  // if (mutation.error) throw mutation.error;

  return (
    <form
      onSubmit={(evt) => {
        evt.preventDefault();
        const data = new FormData(evt.target as HTMLFormElement);

        if (searchErr) {
          return;
        }
        if (!from) {
          setSearchErr('You must select a start location');
          return;
        }

        const date = DateTime.fromISO(data.get('date') as string)
          .toUTC()
          .toISO()!;

        mutation.mutate({
          body: { fromLabel: from.label, fromPoint: from.point, date },
        });
      }}
      className="max-w-3xl grid grid-rows-1 grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-12"
    >
      <div className="flex flex-col gap-6">
        <div>
          <SearchBox
            accessToken={MAPBOX_TOKEN}
            placeholder="Edinburgh Waverley"
            options={{
              language: 'en',
              country: 'gb',
              bbox: [
                [-7.86098, 54.55011],
                [-0.47497, 61.00819],
              ],
              proximity: 'ip',
            }}
            onRetrieve={(resp) => {
              const props = resp.features[0]?.properties;
              if (!props) return;

              const region = props.context.region?.region_code_full;
              if (region && region !== 'GB-SCT') {
                setSearchErr('You must select a location in Scotland');
                return;
              }

              const coords = props.coordinates;
              const routable = coords.routable_points?.[0];

              const point: [number, number] = routable
                ? [routable.longitude, routable.latitude]
                : [coords.longitude, coords.latitude];

              const label = props.name_preferred || props.name;

              setFrom({ point, label });
              setSearchErr(null);
            }}
            onClear={() => {
              setFrom(null);
              setSearchErr(null);
            }}
          />

          {searchErr && (
            <p className="mt-2 text-sm text-red-600">{searchErr}</p>
          )}
        </div>

        <input
          name="date"
          type="date"
          defaultValue={times?.default}
          min={times?.min}
          max={times?.max}
          required
          className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
        ></input>

        <div className="flex justify-end">
          <Button
            type="submit"
            disableWith={mutation.isPending && 'Submitting...'}
          >
            Request report
          </Button>
        </div>
      </div>
      <div className="col-start-2 w-full aspect-1">
        <AddressMinimap
          accessToken={MAPBOX_TOKEN}
          feature={
            from
              ? {
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'Point', coordinates: from.point },
                }
              : undefined
          }
          show={from != null}
        />
      </div>
    </form>
  );
}
