import JSONView from '@/components/JSONView';
import { Layout } from '@/components/Layout';
import {
  fetchMyPendingOrRecentTrackImports,
  fetchMyTracks,
} from '@/features/tracks/api';

export default async function Page() {
  const myImports = await fetchMyPendingOrRecentTrackImports();
  const myTracks = await fetchMyTracks();

  return (
    <Layout pageTitle="Debug My Tracks">
      <JSONView data={{ myImports, myTracks }} />
    </Layout>
  );
}
