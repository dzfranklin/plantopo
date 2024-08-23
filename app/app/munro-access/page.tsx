import { Layout } from '@/components/Layout';
import dynamic from 'next/dynamic';

const RequestReportComponent = dynamic(
  () => import('./RequestReportComponent'),
  { ssr: false },
);

export default function Page() {
  return (
    <Layout pageTitle="Munro Access">
      <RequestReportComponent />
    </Layout>
  );
}
