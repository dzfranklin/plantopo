import { Layout } from '@/components/Layout';
import { GeophotosMap } from '@/features/geophotos/GeophotosMap';

export default function Page() {
  return (
    <Layout
      pageTitle="Geophotos"
      inlineTitle={false}
      wide={true}
      fullBleed={true}
    >
      <GeophotosMap />
    </Layout>
  );
}
