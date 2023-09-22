'use client';

import { AppError, TransportError } from '@/api/errors';
import { AccountInput } from '@/features/account/AccountInput';
import { usePasswordResetRequestMutation } from '@/features/account/api/passwordReset';
import { Layout } from '@/features/layout';
import { InlineErrorComponent } from '@/generic/InlineErrorComponent';
import { Button } from '@adobe/react-spectrum';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';

interface ForgotFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const emailParam = useSearchParams().get('email');
  const methods = useForm<ForgotFormValues>({
    shouldUseNativeValidation: true,
    defaultValues: {
      email: emailParam ?? '',
    },
  });
  const mutation = usePasswordResetRequestMutation();
  const onValid: SubmitHandler<ForgotFormValues> = ({ email }, evt) => {
    evt?.preventDefault();
    mutation.mutate({ email });
  };
  const { setError } = methods;
  useEffect(() => {
    if (mutation.error instanceof AppError) {
      setError('email', { message: mutation.error.message });
    }
  }, [mutation.error, setError]);

  return (
    <Layout className="flex flex-col justify-center flex-1 min-h-full pt-3 pb-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-xl font-bold leading-9 tracking-tight text-center text-gray-900">
          Reset your password
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="px-6 py-12 bg-white shadow sm:rounded-lg sm:px-12">
          {mutation.error instanceof TransportError && (
            <InlineErrorComponent error={mutation.error} />
          )}
          {mutation.isSuccess ? (
            <SuccessMessage email={mutation.variables!.email} />
          ) : (
            <FormProvider {...methods}>
              <form
                onSubmit={methods.handleSubmit(onValid)}
                className="space-y-3"
              >
                <AccountInput
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required={true}
                />

                <div className="flex flex-row justify-end">
                  <Button variant="primary" type="submit">
                    {mutation.isLoading ? 'Sending...' : 'Request reset'}
                  </Button>
                </div>
              </form>
            </FormProvider>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SuccessMessage({ email }: { email: string }) {
  return <p>Password reset email sent to {email}.</p>;
}
