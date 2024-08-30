import { Layout } from '@/components/Layout';
import dynamic from 'next/dynamic';
import { fetchClient } from '@/api/server';
import { ReportMeta } from '@/app/munro-access/report/[id]/[slug]/report';
import Link from 'next/link';
import { DateTime } from 'luxon';
import Skeleton from '@/components/Skeleton';

const RequestReportComponent = dynamic(
  () => import('./RequestReportComponent'),
  { ssr: false, loading: () => <Skeleton height={200} /> },
);

export default async function Page() {
  return (
    <Layout pageTitle="Munro Access">
      <RequestReportComponent />
      <PregeneratedReportsComponent />
    </Layout>
  );
}

async function PregeneratedReportsComponent() {
  const reports = await fetchReports();
  return (
    <ul className="mt-10 md:mt-2">
      {reports.map((report) => (
        <li key={report.id} className="mb-3">
          <Link
            href={`/munro-access/report/${report.id}/${report.slug}`}
            className="link"
          >
            Munros accessible from {report.fromLabel} on{' '}
            {DateTime.fromISO(report.date).toLocaleString({ weekday: 'long' })}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function fetchReports(): Promise<ReportMeta[]> {
  const reportResp = await fetchClient.GET(
    '/munro-access/pregenerated-reports',
  );
  if (reportResp.error) throw reportResp.error;
  return reportResp.data.reports.sort((a, b) => {
    if (a.fromLabel < b.fromLabel) return -1;
    if (a.fromLabel > b.fromLabel) return 1;
    const da = new Date(a.date);
    const db = new Date(b.date);
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
}
