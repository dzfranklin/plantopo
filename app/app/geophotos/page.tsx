import { Layout } from '@/components/Layout';
import { GeophotosMap } from '@/features/geophotos/GeophotosMap';

export default function Page() {
  return (
    <Layout wide={true} pageTitle="Geophotos" inlineTitle={false}>
      <GeophotosMap />
    </Layout>
  );
}
