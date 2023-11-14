'use client';

import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import { useMapCreateMutation } from '@/features/map/api/useMapCreateMutation';
import { ProgressBar } from '@adobe/react-spectrum';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewPage() {
  const session = useSession({ require: true });
  const mutation = useMapCreateMutation({});
  const router = useRouter();
  useEffect(() => {
    if (session && mutation.isIdle) {
      mutation.mutate();
    }
  }, [mutation, session]);
  if (mutation.error) throw mutation.error;
  useEffect(() => {
    if (mutation.isSuccess) {
      router.replace(`/map/${mutation.data.id}`);
    }
  }, [mutation, router]);

  return (
    <Layout pageTitle="New map">
      <ProgressBar isIndeterminate={true} />
    </Layout>
  );
}
