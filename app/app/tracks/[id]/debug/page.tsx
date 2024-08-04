import JSONView from '@/components/JSONView';
import { Layout } from '@/components/Layout';
import { fetchTrack } from '@/features/tracks/api';

export default async function Page({ params }: { params: { id: string } }) {
  const track = await fetchTrack(params.id);
  return (
    <Layout pageTitle={'DEBUG: ' + track.name || 'Unnamed track'}>
      <JSONView data={track} />
    </Layout>
  );
}
