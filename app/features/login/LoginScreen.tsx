import { Logo } from '@/components/Logo';
import Link from 'next/link';
import {
  FormEventHandler,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useId,
} from 'react';
import { $api } from '@/api/client';
import { components } from '@/api/v1';
import InlineAlert from '@/components/InlineAlert';
import { useRouter } from 'next/navigation';
import { useUserID } from '@/features/users/queries';

export function LoginScreen({
  isSignup,
  returnTo,
}: {
  isSignup: boolean;
  returnTo: string | undefined;
}) {
  const router = useRouter();
  const doReturn = useCallback(
    () => router.replace(returnTo ?? '/'),
    [returnTo],
  );

  const signupMutation = $api.useMutation('post', '/auth/register-browser');
  const loginMutation = $api.useMutation('post', '/auth/authenticate-browser');
  const status = isSignup ? signupMutation.status : loginMutation.status;
  const error = isSignup ? signupMutation.error : loginMutation.error;

  const user = useUserID();
  useEffect(() => {
    if (user !== null) doReturn();
  }, [doReturn, user]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();

    const el = evt.currentTarget;
    const data = new FormData(el);

    const setValidity = (name: string, msg: string) =>
      (
        el.querySelector(`input[name=${name}]`) as HTMLInputElement
      ).setCustomValidity(msg);

    const name = data.get('name') as string | null;
    const email = data.get('email') as string;
    const password = data.get('password') as string;
    const confirmPassword = data.get('confirm-password') as string | null;

    const onError = (
      err: components['responses']['DefaultErrorResponse']['content']['application/json'],
    ) => {
      const fieldErrors = err.validationErrors?.fieldErrors;
      if (fieldErrors) {
        for (const [name, msg] of Object.entries(fieldErrors)) {
          setValidity(name, msg);
        }
      }
    };

    const onSuccess = ({ user }: { user: components['schemas']['User'] }) => {
      console.log('logging in', user);
      doReturn();
    };

    if (isSignup) {
      if (!name || !confirmPassword) throw new Error('Unreachable');
      if (password !== confirmPassword) {
        setValidity('confirm-password', 'Your passwords do not match');
        return;
      }
      signupMutation.mutate(
        { body: { name, email, password } },
        { onError, onSuccess },
      );
    } else {
      loginMutation.mutate(
        { body: { email, password } },
        { onError, onSuccess },
      );
    }
  };

  return (
    <div className="flex h-full min-h-full flex-1 bg-white">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <Logo />
            <h2 className="mt-6 text-2xl font-bold leading-9 tracking-tight text-gray-900">
              {isSignup ? 'Sign up for an account' : 'Sign in to your account'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {isSignup ? 'Already have an account?' : 'No account?'}{' '}
              <Link
                href={isSignup ? '/login' : '/signup'}
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                {isSignup ? 'Log in' : 'Sign up'}
              </Link>
              .
            </p>
          </div>

          <div className="mt-10">
            <div>
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <InlineAlert variant="error">
                    {error.validationErrors?.generalErrors
                      ? `${error.message}: ${error.validationErrors.generalErrors.join(', ')}`
                      : error.message}
                  </InlineAlert>
                )}

                {isSignup && (
                  <Input
                    label="Name"
                    name="name"
                    type="text"
                    required={true}
                    autoComplete="name"
                    minLength={1}
                    maxLength={500}
                  />
                )}
                <Input
                  label="Email address"
                  name="email"
                  type="email"
                  required={true}
                  autoComplete="email"
                  onInput={(evt) => {
                    const el = evt.currentTarget;
                    el.setCustomValidity('');
                  }}
                />
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  required={true}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={8}
                  maxLength={100}
                />
                {isSignup && (
                  <Input
                    label="Confirm password"
                    name="confirm-password"
                    type="password"
                    required={true}
                    autoComplete="new-password"
                  />
                )}
                {!isSignup && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm leading-6">
                      <Link
                        href="/login/forgot-password"
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                )}
                <div>
                  <button
                    type="submit"
                    className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-500"
                    disabled={status === 'pending' || status === 'success'}
                  >
                    {status === 'pending' || status === 'success'
                      ? 'Loading...'
                      : isSignup
                        ? 'Sign up'
                        : 'Log in'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          alt=""
          src="/historic_usgs_quad.webp"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

function Input({
  label,
  ...params
}: {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        {label}
      </label>
      <div className="mt-2">
        <input
          id={id}
          {...params}
          className="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        />
      </div>
    </div>
  );
}
