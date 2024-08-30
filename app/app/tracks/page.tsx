import { Layout } from '@/components/Layout';
import {
  fetchMyPendingOrRecentTrackImports,
  fetchMyTracks,
  Track,
  TrackImport,
} from '@/features/tracks/api';
import TrackGridComponent from './TrackGridComponent';
import TrackUploadButton from '../../features/tracks/upload/TrackUploadButton';
import InlineAlert from '@/components/InlineAlert';
import TracksEmptyStateComponent from '@/features/tracks/upload/TracksEmptyStateComponent';
import { AuthorizationError } from '@/api_to_remove';
import UnauthorizedScreen from '@/components/UnauthorizedScreen';

// TODO: Live load updated status as imports progress

export default async function Page() {
  return <div>Temporarily disabled</div>;
  let myImports: TrackImport[];
  let myTracks: Track[];
  try {
    [myImports, myTracks] = await Promise.all([
      fetchMyPendingOrRecentTrackImports(),
      fetchMyTracks(),
    ]);
  } catch (err) {
    console.error('Failed to fetch my tracks', err);
    if (err instanceof AuthorizationError) {
      return await UnauthorizedScreen();
    } else {
      throw err;
    }
  }
  console.log('rendered tracks page');

  const pendingImports = myImports.filter(
    (entry) => entry.failedAt === undefined && entry.completedAt === undefined,
  );
  const failedImports = myImports.filter(
    (entry) => entry.failedAt !== undefined,
  );

  return (
    <Layout pageTitle="My Tracks" className="flex flex-col">
      <div className="mb-4">
        <TrackUploadButton />
      </div>

      <div className="mb-4">
        {pendingImports.length > 0 && (
          <InlineAlert variant="info">
            <details>
              <summary>{pendingImports.length} pending imports</summary>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                {pendingImports.map((entry) => (
                  <li key={entry.id}>{entry.filename}</li>
                ))}
              </ul>
            </details>
          </InlineAlert>
        )}

        {failedImports.length > 0 && (
          <InlineAlert variant="error">
            <details>
              <summary>{failedImports.length} failed imports</summary>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                {failedImports.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-medium">{entry.filename}</span>:{' '}
                    {entry.error}
                  </li>
                ))}
              </ul>
            </details>
          </InlineAlert>
        )}
      </div>

      {myTracks.length === 0 && (
        <div className="grow mb-20">
          <TracksEmptyStateComponent />
        </div>
      )}

      <ul
        role="list"
        className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:gap-x-8"
      >
        {myTracks.map((track) => (
          <li key={track.id} className="relative">
            <TrackGridComponent track={track} />
          </li>
        ))}
      </ul>
    </Layout>
  );
}
