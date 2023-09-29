'use client';

import { AppError } from '@/api/errors';
import { validatePassword } from '@/app/signup/validatePassword';
import { AccountInput } from '@/features/account/AccountInput';
import {
  usePasswordResetCheckQuery,
  usePasswordResetCompleteMutation,
} from '@/features/account/api/passwordReset';
import { Layout } from '@/features/layout';
import { InlineErrorComponent } from '@/features/error/InlineErrorComponent';
import cls from '@/generic/cls';
import { Button, ProgressCircle } from '@adobe/react-spectrum';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';

interface ResetFormValues {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const token = useSearchParams()?.get('token') ?? '';
  const checkQuery = usePasswordResetCheckQuery(token);
  const mutation = usePasswordResetCompleteMutation();
  const methods = useForm<ResetFormValues>();
  const onValid: SubmitHandler<ResetFormValues> = (values, evt) => {
    evt?.preventDefault();
    mutation.mutate({
      token,
      password: values.password,
    });
  };

  const fieldError =
    mutation.error instanceof AppError && mutation.error.reason === 'fieldError'
      ? mutation.error.details
      : undefined;
  const { setError } = methods;
  useEffect(() => {
    if (fieldError && 'password' in fieldError) {
      setError('password', { message: fieldError?.password });
    }
  }, [fieldError, setError]);

  return (
    <Layout className="flex flex-col justify-center flex-1 min-h-full pt-3 pb-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-xl font-bold leading-9 tracking-tight text-center text-gray-900">
          Reset your password
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="px-6 py-12 bg-white shadow sm:rounded-lg sm:px-12">
          {checkQuery.error && (
            <InlineErrorComponent error={checkQuery.error} />
          )}
          {mutation.error && !fieldError && (
            <InlineErrorComponent error={mutation.error} />
          )}

          <FormProvider {...methods}>
            <form
              onSubmit={methods.handleSubmit(onValid)}
              className="space-y-3"
            >
              <div className="relative mb-10 rounded-md shadow-sm">
                <input
                  type="email"
                  readOnly={true}
                  value={checkQuery.data?.user.email ?? ''}
                  className={cls(
                    'block w-full rounded-md border-0 py-1.5 text-gray-900',
                    'ring-1 ring-inset ring-gray-300 placeholder:text-gray-400',
                    'sm:text-sm sm:leading-6',
                  )}
                />
                {checkQuery.isInitialLoading && (
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                    <ProgressCircle
                      aria-label="loading"
                      size="S"
                      isIndeterminate
                    />
                  </div>
                )}
              </div>

              <AccountInput
                name="password"
                label="New password"
                type="password"
                autoComplete="new-password"
                required={true}
                validate={validatePassword}
              />

              <AccountInput
                name="confirmPassword"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                required={true}
                validate={(v, values: ResetFormValues) => {
                  return v === values.password || 'must match new password';
                }}
              />

              <div className="flex flex-row justify-end">
                <Button
                  variant="primary"
                  type="submit"
                  isDisabled={checkQuery.isLoading || mutation.isLoading}
                >
                  {mutation.isIdle ? 'Reset' : 'Resetting...'}
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>
      </div>
    </Layout>
  );
}
