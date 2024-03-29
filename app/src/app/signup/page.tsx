'use client';

import { AppError, TransportError } from '@/api/errors';
import { AccountInput } from '@/features/account/AccountInput';
import { useRegisterMutation } from '@/features/account/api/useRegisterMutation';
import { useSession } from '@/features/account/session';
import { Layout } from '@/features/layout';
import { InlineErrorComponent } from '@/features/error/InlineErrorComponent';
import cls from '@/generic/cls';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { validatePassword } from './validatePassword';

interface SignupFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const router = useRouter();
  const session = useSession();
  const params = useSearchParams();
  const returnToEncoded = params?.get('returnTo');
  const initialEmail = decodeURIComponent(params?.get('email') || '');

  useEffect(() => {
    if (session) {
      // Either the user visited when already logged in or the mutation succeeded.
      router.replace(
        returnToEncoded ? decodeURIComponent(returnToEncoded) : '/dashboard',
      );
    }
  }, [session, router, returnToEncoded]);

  const mutation = useRegisterMutation();
  const methods = useForm<SignupFormValues>({
    shouldUseNativeValidation: false,
    defaultValues: { email: initialEmail },
  });

  const onValid: SubmitHandler<SignupFormValues> = (values, evt) => {
    evt?.preventDefault();
    if (values.confirmPassword !== values.password) {
      throw new Error('Unreachable: validation should ensure passwords match');
    }
    mutation.mutate({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
    });
  };

  const setError = methods.setError;
  useEffect(() => {
    if (
      mutation.error instanceof AppError &&
      mutation.error.reason === 'badField' &&
      mutation.error.details
    ) {
      for (const field of ['email', 'fullName', 'password'] as const) {
        if (mutation.error.details[field]) {
          setError(field, {
            type: 'manual',
            message: mutation.error.details[field],
          });
        }
      }
    }
  }, [mutation.error, setError]);

  const [isReady, setIsReady] = useState(false);
  useEffect(() => setIsReady(true), []);

  return (
    <Layout className="flex flex-col justify-center flex-1 min-h-full pt-3 pb-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-xl font-bold leading-9 tracking-tight text-center text-gray-900">
          Sign up for an account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        {mutation.error instanceof TransportError && (
          <InlineErrorComponent error={mutation.error} />
        )}

        <div className="px-6 py-12 bg-white shadow sm:rounded-lg sm:px-12">
          <FormProvider {...methods}>
            <form
              onSubmit={methods.handleSubmit(onValid)}
              className="space-y-3"
            >
              <AccountInput
                name="fullName"
                label="Full name"
                required={true}
                maxLength={{ value: 255, message: 'is too long' }}
                autoComplete="name"
              />

              <AccountInput
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                required={true}
                maxLength={{ value: 255, message: 'is too long' }}
              />

              <AccountInput
                name="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                required={true}
                validate={validatePassword}
              />

              <AccountInput
                name="confirmPassword"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required={true}
                validate={(v, values: SignupFormValues) => {
                  return v === values.password || 'must match password';
                }}
              />

              <div>
                <button
                  type="submit"
                  disabled={!isReady || mutation.isLoading}
                  className={cls(
                    'flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5',
                    'text-sm font-semibold leading-6 text-white shadow-sm',
                    'hover:bg-indigo-500 disabled:bg-indigo-400',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                  )}
                >
                  {mutation.isLoading || mutation.isSuccess
                    ? 'Registering...'
                    : 'Sign up'}
                </button>
              </div>
            </form>
          </FormProvider>
        </div>

        <p className="mt-10 text-sm text-center text-gray-500">
          Already have an account?{' '}
          <Link
            href={
              returnToEncoded ? `/login?returnTo=${returnToEncoded}` : '/login'
            }
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          >
            Log in
          </Link>
        </p>
      </div>
    </Layout>
  );
}
