'use client';

import { AppError, TransportError } from '@/api/errors';
import { useConfirmCompleteMutation } from '@/features/account/api/useConfirmMutation';
import { InlineErrorComponent } from '@/generic/InlineErrorComponent';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

export default function ConfirmPage() {
  const token = useSearchParams().get('token');
  const mutation = useConfirmCompleteMutation();
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="w-full h-full max-w-xl bg-white shadow sm:h-fit sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {(!token || mutation.isError) && (
            <>
              {!token && <ConfirmIssue reason="tokenInvalid" />}
              {mutation.error instanceof TransportError && (
                <InlineErrorComponent error={mutation.error} />
              )}
              {mutation.error instanceof AppError && (
                <ConfirmIssue reason={mutation.error.reason} />
              )}
            </>
          )}
          {token && mutation.isIdle && (
            <>
              <h3 className="mb-5 text-base font-semibold leading-6 text-gray-900">
                Confirm your email
              </h3>
              <div className="flex flex-row justify-end">
                <button
                  type="button"
                  onClick={() => mutation.mutate({ token })}
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  {mutation.isLoading ? 'Confirming...' : 'Confirm'}
                </button>
              </div>
            </>
          )}
          {mutation.isSuccess && (
            <>
              <h3 className="mb-5 text-base font-semibold leading-6 text-gray-900">
                All done!
              </h3>
              <div className="flex flex-row justify-end">
                <Link
                  href="/"
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  Get started
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmIssue({ reason }: { reason: string | undefined }) {
  let primary: ReactNode;
  let secondary: ReactNode;
  switch (reason) {
    case 'tokenInvalid':
      primary = 'Invalid confirmation link';
      secondary = 'Try copying and pasting the link from your email.';
      break;
    case 'tokenExpired':
      primary = 'Your confirmation link has expired';
      secondary = (
        <>
          Request a{' '}
          <Link href="/account/reconfirm" className="link">
            new confirmation link
          </Link>
          .
        </>
      );
      break;
    case 'tokenUsed':
      primary = 'Your confirmation link has already been used';
      secondary = (
        <>
          <Link href="/login" className="link">
            Log in
          </Link>{' '}
          to your account.
        </>
      );
      break;
    default:
      primary = 'Something went wrong';
  }

  return (
    <div className="max-w-xl text-sm">
      <h3 className="mb-5 text-base font-semibold leading-6 text-red-500">
        {primary}
      </h3>
      <p>{secondary}</p>
      <p>If you need help you can contact me at daniel@plantopo.com</p>
    </div>
  );
}
