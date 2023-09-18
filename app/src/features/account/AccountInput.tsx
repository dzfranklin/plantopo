import cls from '@/generic/cls';
import React, { useId } from 'react';
import {
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';
import FieldErrorIcon from '@spectrum-icons/workflow/AlertCircleFilled';

export function AccountInput<TFieldValues extends FieldValues>({
  label,
  name,
  type,
  autoComplete,
  invalidExtra,
  ...registerOptions
}: {
  label: string;
  name: Path<TFieldValues>;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  invalidExtra?: () => React.ReactNode;
} & RegisterOptions<TFieldValues>) {
  const id = useId();
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();
  const error = errors[name];
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-1 text-sm font-medium leading-6 text-gray-900"
      >
        {label}
      </label>

      <div className="relative rounded-md shadow-sm">
        <input
          id={id}
          {...register(name, registerOptions)}
          type={type}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cls(
            'block w-full rounded-md border-0 py-1.5 text-gray-900',
            'ring-1 ring-inset ring-gray-300 placeholder:text-gray-400',
            'sm:text-sm sm:leading-6',
            'focus:ring-2 focus:ring-inset focus:ring-indigo-600',
            !!error &&
              'text-red-900 ring-1 ring-inset ring-red-300 placeholder:text-red-300',
          )}
        />

        {error && (
          <div
            className={cls(
              'absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none',
              'text-red-500',
            )}
          >
            <FieldErrorIcon height="1.1rem" aria-hidden="true" />
          </div>
        )}
      </div>

      <ErrorMessage
        inputId={id}
        label={label}
        error={error}
        invalidExtra={invalidExtra}
      />
    </div>
  );
}

function ErrorMessage<TFieldValues>({
  inputId,
  label,
  error,
  invalidExtra,
}: {
  inputId: string;
  label: string;
  error: FieldErrors[Path<TFieldValues>];
  invalidExtra?: () => React.ReactNode;
}) {
  return (
    <div
      id={`${inputId}-error`}
      className="flex flex-row justify-between min-h-[1.25rem] mt-1.5 text-sm"
    >
      {error && (
        <>
          <span className="text-red-600">
            {label} {errorMessageFor(error)}
          </span>
          <span>{invalidExtra?.()}</span>
        </>
      )}
    </div>
  );
}

function errorMessageFor<TFieldValues>(
  error: NonNullable<FieldErrors[Path<TFieldValues>]>,
): string {
  if (error.message) {
    if (typeof error.message === 'string') {
      return error.message;
    } else {
      return errorMessageFor(error.message);
    }
  } else if (error.type === 'required') {
    return 'is required';
  } else {
    return 'is invalid';
  }
}
