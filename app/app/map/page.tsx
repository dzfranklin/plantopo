'use client';

import { Layout } from '@/components/Layout';
import { MapComponent } from '@/features/map/MapComponent';

export default function Page() {
  return (
    <Layout fullBleed={true}>
      <MapComponent />
    </Layout>
  );
}
