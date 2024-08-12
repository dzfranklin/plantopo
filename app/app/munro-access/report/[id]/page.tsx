import { Layout } from '@/components/Layout';
import { MunroAccessReportLoader } from './MunroAccessReport';

export default function Page({ params: { id } }: { params: { id: string } }) {
  let reportURL: string;
  if (id === 'sample') {
    // TODO: fixme
    reportURL = 'https://localhost/TODO_FIXME_munro-access/sample_report.json';
  } else {
    throw new Error('Unimplemented');
  }
  return (
    <Layout pageTitle="Munro Access Report">
      <MunroAccessReportLoader reportURL={reportURL} />
    </Layout>
  );
}
