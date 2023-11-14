'use client';

import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import { usePendingAccessRequests } from '@/features/map/api/accessRequestApi';
import { MapsManagerComponent } from '@/features/map/manager/MapsManagerComponent';
import Link from 'next/link';

export default function DashboardPage() {
  useSession({ require: true });

  const pendingAccessRequestsQuery = usePendingAccessRequests();
  const pendingAccessRequests = pendingAccessRequestsQuery.data?.length;

  return (
    <Layout pageTitle="Dashboard">
      {!!pendingAccessRequests && (
        <div className="p-4 mb-8 border-l-4 border-green-400 bg-green-50">
          <div className="flex ml-3">
            <p className="text-sm text-green-700">
              You have {pendingAccessRequests} access{' '}
              {pendingAccessRequests > 1 ? 'requests' : 'request'} waiting for
              your approval.{' '}
              <Link
                href="/access"
                className="text-green-700 underline hover:text-green-600"
              >
                Manage requests
              </Link>
            </p>
          </div>
        </div>
      )}
      <MapsManagerComponent />
    </Layout>
  );
}
