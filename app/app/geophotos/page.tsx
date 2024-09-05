import { Layout } from '@/components/Layout';
import { GeophotosComponent } from '@/features/geophotos/GeophotosComponent';

export default function Page() {
  return (
    <Layout
      pageTitle="Geophotos"
      inlineTitle={false}
      wide={true}
      fullBleed={true}
    >
      <GeophotosComponent />
    </Layout>
  );
}
