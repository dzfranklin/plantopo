'use client';

import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import { MapsManagerComponent } from '@/features/map/manager/MapsManagerComponent';

export default function DashboardPage() {
  useSession({ require: true });

  return (
    <Layout pageTitle="Dashboard">
      <MapsManagerComponent />
    </Layout>
  );
}
