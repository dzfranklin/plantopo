import { TrackScreen } from '@/app/tracks/[id]/TrackScreen';

export default async function Page({ params }: { params: { id: string } }) {
  return <TrackScreen id={params.id} />;
}
