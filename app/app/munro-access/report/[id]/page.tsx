import { MunroAccessReportLoader } from './MunroAccessReport';
import { fetchClient } from '@/api/server';
import { notFound } from 'next/navigation';

export default async function Page({
  params: { id },
}: {
  params: { id: string };
}) {
  const statusReq = fetchClient.GET('/munro-access/report/{id}/status', {
    params: { path: { id } },
  });
  const munrosReq = fetchClient.GET('/munro-access/munros');
  const [status, munros] = await Promise.all([statusReq, munrosReq]);
  if (!status.data && status.response.status === 404) {
    notFound();
  } else if (!status.data) {
    throw new Error('failed to fetch report status');
  }
  if (!munros.data) {
    throw new Error('failed to fetch munros');
  }

  return (
    <MunroAccessReportLoader
      id={id}
      munros={munros.data.munros}
      initialStatus={status.data}
    />
  );
}
