'use client';

import { LoginScreen } from '@/features/login/LoginScreen';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/dialog';
import { useCallback, useState } from 'react';
import { Button } from '@/components/button';
import { $api } from '@/api/client';
import { toast } from 'react-hot-toast';
import {
  pageSearchParams,
  PageSearchParams,
  searchParamValue,
} from '@/app/util';

export default function Page({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const router = useRouter();

  const demoMode = 'demo' in searchParams;
  const returnTo = searchParamValue(searchParams, 'returnTo') ?? '/';

  const [isLoggingInToDemo, setIsLoggingInToDemo] = useState(false);
  const cancelDemo = useCallback(() => {
    const newParams = pageSearchParams(searchParams);
    newParams.delete('demo');
    router.replace('?' + newParams.toString());
  }, [router, searchParams]);
  const loginToDemoMode = useLoginToDemoMode();

  return (
    <>
      <LoginScreen isSignup={false} returnTo={returnTo} />

      <Dialog open={demoMode} onClose={cancelDemo}>
        <Dialog.Title>Demo Mode</Dialog.Title>
        <Dialog.Body>
          This link allows you to login to a shared demo account. Anything in
          the demo account is <strong>public</strong> and will be deleted
          regularly.
        </Dialog.Body>
        <Dialog.Actions>
          <Button onClick={cancelDemo}>Cancel</Button>
          <Button
            color="primary"
            disableWith={isLoggingInToDemo && 'Logging in...'}
            onClick={() => {
              setIsLoggingInToDemo(true);
              loginToDemoMode(returnTo);
            }}
          >
            Login to demo account
          </Button>
        </Dialog.Actions>
      </Dialog>
    </>
  );
}

function useLoginToDemoMode() {
  const mutation = $api.useMutation('post', '/auth/authenticate-browser');
  const router = useRouter();
  return useCallback(
    (returnTo: string) => {
      mutation.mutate(
        {
          body: {
            email: 'demo@plantopo.com',
            password: 'password',
          },
        },
        {
          onSuccess: () => {
            toast.success('Demo mode');
            router.replace(returnTo || '/');
          },
        },
      );
    },
    [router, mutation],
  );
}
