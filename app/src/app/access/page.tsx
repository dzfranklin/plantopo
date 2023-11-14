'use client';

import { useSearchParams } from 'next/navigation';
import { DateTimeText } from '@/generic/DateTimeText';
import { Button, ButtonGroup } from '@adobe/react-spectrum';
import { Layout } from '@/features/layout';
import {
  PendingAccessRequest,
  useApproveAccessRequestMutation,
  usePendingAccessRequests,
  useRejectAccessRequestMutation,
} from '@/features/map/api/accessRequestApi';
import { useMemo } from 'react';

export default function AccessPage() {
  const params = useSearchParams();
  const requestId = params?.get('requestId') ?? null;
  const list = usePendingAccessRequests();
  if (list.error) throw list.error;

  const [requested, rest] = useMemo(() => {
    let requested: PendingAccessRequest | null = null;
    const rest: PendingAccessRequest[] = [];
    for (const r of list.data ?? []) {
      if (r.id == requestId) {
        requested = r;
      } else {
        rest.push(r);
      }
    }
    return [requested, rest];
  }, [list.data, requestId]);

  return (
    <Layout pageTitle="Access requests">
      <ul className="divide-y divide-gray-100">
        {!requested && rest.length === 0 && (
          <li className="py-4 text-center text-gray-500">
            You have no pending access requests
          </li>
        )}

        {requested && <PendingRequestComponent request={requested} />}
        {rest.map((r) => (
          <PendingRequestComponent request={r} key={r.id} />
        ))}
      </ul>
    </Layout>
  );
}

function PendingRequestComponent({
  request,
}: {
  request: PendingAccessRequest;
}) {
  const approveMutation = useApproveAccessRequestMutation(request.id);
  const rejectMutation = useRejectAccessRequestMutation(request.id);
  const isMutating = approveMutation.isLoading || rejectMutation.isLoading;
  if (approveMutation.error) throw approveMutation.error;
  if (rejectMutation.error) throw rejectMutation.error;
  return (
    <li className="flex flex-col py-8 gap-x-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">
            {request.requestingUserFullName}{' '}
          </span>
          <span className="text-gray-500 truncate">
            ({request.requestingUserEmail}){' '}
          </span>
          <span className="text-gray-500">requests access to </span>
          <a href={`/map/${request.mapId}`} className="font-semibold link">
            {request.mapName}
          </a>

          <span className="mx-4 inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-900 ring-1 ring-inset ring-gray-200">
            Role: {request.requestedRole}
          </span>
        </div>

        <ButtonGroup isDisabled={isMutating}>
          <Button variant="negative" onPress={() => rejectMutation.mutate()}>
            {!rejectMutation.isLoading ? 'Deny' : 'Denying...'}
          </Button>
          <Button variant="cta" onPress={() => approveMutation.mutate()}>
            {!approveMutation.isLoading ? 'Approve' : 'Approving...'}
          </Button>
        </ButtonGroup>
      </div>
      <div>
        <blockquote className="p-2 mt-4 mb-2 border-gray-300 border-s-4 bg-gray-50">
          <p className="italic text-gray-900]">
            {request.message || 'No message'}
          </p>
        </blockquote>
        <div>
          <span className="text-sm text-gray-500 truncate">
            <DateTimeText utc={request.createdAt} />
          </span>
        </div>
      </div>
    </li>
  );
}
