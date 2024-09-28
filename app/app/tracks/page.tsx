import { Layout } from '@/components/Layout';
import { TracksScreen } from './Screen';
import { PageActions } from './PageActions';
import { Suspense } from 'react';
import Skeleton from '@/components/Skeleton';

export default function Page() {
  return (
    <Layout
      pageTitle="My Tracks"
      className="flex flex-col"
      pageActions={<PageActions />}
    >
      <Suspense fallback={<Skeleton />}>
        <TracksScreen />
      </Suspense>
    </Layout>
  );
}
