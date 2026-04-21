import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useTRPC } from "@/trpc";

export default function MyTracksPage() {
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
                className="block rounded border p-2 hover:bg-gray-50">
                <p className="font-semibold">{track.name}</p>
                <p className="text-sm text-gray-600">
                  Recorded at {new Date(track.createdAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
