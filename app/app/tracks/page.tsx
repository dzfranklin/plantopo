import { Layout } from '@/components/Layout';
import { TracksScreen } from './Screen';
import { PageActions } from './PageActions';

export default function Page() {
  return (
    <Layout
      pageTitle="My Tracks"
      className="flex flex-col"
      pageActions={<PageActions />}
    >
      <TracksScreen />
    </Layout>
  );
}
