'use client';

import { useEffect, useState } from 'react';
import { createEventSource } from 'eventsource-client';
import { MunroList, reportDataSchema, ReportStatus } from './report';
import Skeleton from '@/components/Skeleton';
import { Layout } from '@/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINT } from '@/env';
import { MunroAccessReport } from '@/app/munro-access/report/[id]/MunroAccessReport';
import { WaitForReportComponent } from '@/app/munro-access/report/[id]/WaitForReportComponent';
import { useFormattedDate } from '@/components/Date';

export function MunroAccessReportLoader({
  id,
  munros,
  initialStatus,
}: {
  id: string;
  munros: MunroList;
  initialStatus: ReportStatus;
}) {
  const status = useStatusSubscription(id, initialStatus);

  const report = useQuery({
    queryKey: [status.report.url],
    queryFn: async () =>
      reportDataSchema.parse(await (await fetch(status.report.url!)).json()),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!status.report.url,
  });
  if (report.error) {
    throw report.error;
  }

  const formattedDate = useFormattedDate(status.report.date);
  const title = `Munro access report for ${status.report.fromLabel} on ${formattedDate}`;

  if (status.status !== 'ready') {
    return (
      <Layout pageTitle={title}>
        <WaitForReportComponent status={status} />
      </Layout>
    );
  } else if (!report.data) {
    return (
      <Layout pageTitle={title} wide={true}>
        <Skeleton />
      </Layout>
    );
  } else {
    return (
      <Layout pageTitle={title} wide={true}>
        <MunroAccessReport report={report.data} munros={munros} />
      </Layout>
    );
  }
}

function useStatusSubscription(
  reportID: string,
  initialStatus: ReportStatus,
): ReportStatus {
  const [status, setStatus] = useState(initialStatus);
  const isReady = status.status === 'ready';
  useEffect(() => {
    if (isReady) return;
    console.log('subscribing to status updates');
    const events = createEventSource({
      url: API_ENDPOINT + `munro-access/report/${reportID}/status-updates`,
      onMessage: ({ data, event }) => {
        if (event === 'status') {
          setStatus((p) => (p.status === 'ready' ? p : JSON.parse(data)));
        }
      },
      onConnect: () => console.log('connected'),
      onDisconnect: () => console.log('disconnected'),
      onScheduleReconnect: ({ delay }) =>
        console.log(`disconnected, retrying after ${delay}ms`),
    });
    return () => events.close();
  }, [reportID, isReady]);
  return status;
}
