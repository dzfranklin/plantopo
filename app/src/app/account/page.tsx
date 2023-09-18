'use client';

import { UserImage } from '@/features/account/UserImage';
import { User } from '@/features/account/api/User';
import { useRerequestConfirmationMutation } from '@/features/account/api/useRerequestConfirmationMutation';
import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import { InlineErrorComponent } from '@/generic/InlineErrorComponent';
import cls from '@/generic/cls';

export default function AccountPage() {
  const session = useSession({ require: true });
  return (
    <Layout pageTitle="Account">
      <div className="flex items-center px-5 mb-10">
        <div className="flex-shrink-0">
          <UserImage width={40} user={session?.user} />
        </div>
        <div className="ml-3 font-medium leading-none">
          <div className="text-base text-gray-600">
            {session?.user.fullName}
          </div>
          <div className="text-sm text-gray-500">{session?.user.email}</div>
        </div>
      </div>

      {session && !session.user.confirmedAt && (
        <UnconfirmedActionPanel user={session.user} />
      )}
    </Layout>
  );
}

function UnconfirmedActionPanel({ user }: { user: User }) {
  const mutation = useRerequestConfirmationMutation();
  return (
    <div className="bg-white shadow sm:rounded-lg max-w-fit">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-base font-semibold leading-6 text-gray-900">
          Confirm your email address
        </h3>
        <div className="mt-2 sm:flex sm:items-start sm:justify-between">
          <div className="max-w-xl text-sm text-gray-500">
            <p>
              You haven&apos;t confirmed your email address yet. We sent you an
              email with a confirmation link when you signed up. Click the link
              in the email to confirm your email address.
            </p>
          </div>

          {mutation.isError && <InlineErrorComponent error={mutation.error} />}

          <div className="mt-5 sm:ml-6 sm:mt-0 sm:flex sm:flex-shrink-0 sm:items-center">
            {!mutation.isSuccess && (
              <button
                onClick={() => mutation.mutate({ email: user.email })}
                disabled={mutation.isLoading}
                type="button"
                className={cls(
                  'inline-flex items-center px-3 py-2',
                  'text-sm font-semibold text-gray-900 bg-white',
                  'rounded-md shadow-sm ring-1 ring-inset ring-gray-300',
                  'disabled:opacity-50 hover:bg-gray-50',
                )}
              >
                {mutation.isLoading ? 'Sending...' : 'Resend email'}
              </button>
            )}
            {mutation.isSuccess && (
              <span className="inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 bg-white rounded-md ring-1 ring-inset ring-gray-300">
                Email sent
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
