import { Track, fetchTrack } from '@/features/tracks/api';
import { AuthorizationError } from '@/api';
import UnauthorizedScreen from '@/components/UnauthorizedScreen';
import TrackView from './TrackView';
import TrackActions from '@/features/tracks/TrackActions';
import { Layout } from '@/components/Layout';

export default async function Page({ params }: { params: { id: string } }) {
  let track: Track;
  try {
    track = await fetchTrack(params.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return await UnauthorizedScreen();
    } else {
      throw err;
    }
  }

  return (
    <Layout
      pageTitle={track.name || 'Unnamed track'}
      pageActions={<TrackActions track={track} />}
    >
      <TrackView track={track} />
    </Layout>
  );
}
