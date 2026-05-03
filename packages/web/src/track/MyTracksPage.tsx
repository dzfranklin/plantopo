import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Link } from "react-router-dom";

import type { RecordedTrackSummary } from "../../../api/src/track/track.service";
import { DistanceView, DurationView, InstantView } from "@/components/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import useResizeObserver from "@/hooks/useResizeObserver";
import { useTRPC } from "@/trpc";

export default function MyTracksPage() {
  usePageTitle("My Tracks");
  const trpc = useTRPC();
  const query = useQuery(trpc.track.listRecordedTracks.queryOptions());

  return (
    <div className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold">My Tracks</h1>
      {query.isLoading && <p>Loading...</p>}
      {query.data && (
        <ul className="flex flex-col gap-4">
          {query.data.map(track => (
            <li key={track.id}>
              <TrackCard track={track} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackCard({ track }: { track: RecordedTrackSummary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sizing = useResizeObserver(containerRef);

  const preview =
    sizing && sizing.contentRect.width <= 450
      ? track.previewSmall
      : track.preview;

  return (
    <Link
      to={`/track/${track.id}`}
      className="flex max-w-2xl flex-col overflow-hidden rounded border hover:bg-gray-50">
      <div ref={containerRef} className="bg-muted relative aspect-[4/1] w-full">
        {preview && (
          <img
            src={preview.src}
            width={preview.width}
            height={preview.height}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      <div className="p-3 text-sm">
        {track.name ? (
          <p className="truncate font-medium text-gray-900">{track.name}</p>
        ) : (
          <p className="text-gray-500 italic">Unnamed Track</p>
        )}
        <p className="text-xs text-gray-600">
          <DistanceView m={track.distanceM} /> &bull;{" "}
          <DurationView ms={track.durationMs} /> &bull;{" "}
          <InstantView date={track.startTime} />
        </p>
      </div>
    </Link>
  );
}
