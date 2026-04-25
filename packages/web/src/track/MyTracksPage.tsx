import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { DistanceView, DurationView, InstantView } from "@/components/format";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTRPC } from "@/trpc";

export default function MyTracksPage() {
  usePageTitle("My Tracks");
  const trpc = useTRPC();
  const query = useQuery(trpc.track.listRecordedTracks.queryOptions());

  return (
    <div className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-4 text-2xl font-bold">My Tracks</h1>
      {query.isLoading && <p>Loading...</p>}
      {query.data && (
        <ul className="space-y-2">
          {query.data.map(track => (
            <li key={track.id}>
              <Link
                to={`/track/${track.id}`}
                className="flex rounded border p-2 text-sm hover:bg-gray-50">
                <p className="grow truncate">
                  {track.name ? (
                    <span className="font-medium text-gray-900">
                      {track.name}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Unnamed Track</span>
                  )}
                </p>
                <p className="text-gray-600">
                  <InstantView date={track.startTime} /> &bull;{" "}
                  <DistanceView m={track.distanceM} /> &bull;{" "}
                  <DurationView ms={track.durationMs} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
