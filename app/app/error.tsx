'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
}: {
  error: unknown;
  reset: () => void;
}) {
  const errCode =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'number'
      ? error.code
      : null;

  useEffect(() => {
    if (errCode === 401) return;
    // TODO: Log the error to an error reporting service
    console.error('got error', error);
  }, [errCode, error]);

  if (errCode === 401) {
    if (typeof window !== 'undefined') {
      console.log('error handler: redirecting to login after 401');
      const currentPath = location.pathname + location.search + location.hash;
      location.replace('/login?returnTo=' + encodeURIComponent(currentPath));
    }
    return;
  }

  return (
    <div className="p-8 w-full max-w-full h-full max-h-full flex justify-center items-center prose">
      <div className="space-y-6 max-w-full">
        <h2>Something went wrong!</h2>
        <button
          onClick={() => location.reload()}
          type="button"
          className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Reload this page
        </button>

        <details className="max-w-full">
          <summary>Technical info</summary>

          {typeof error === 'object' && error !== null && (
            <pre>
              {'code' in error &&
                typeof error.code === 'number' &&
                error.code + ': '}

              {'message' in error &&
                typeof error.message === 'string' &&
                error.message}
            </pre>
          )}

          {typeof error === 'object' &&
            error !== null &&
            'stack' in error &&
            typeof error.stack === 'string' && (
              <pre className="max-h-80 max-w-full overflow-auto">
                {error.stack}
              </pre>
            )}
        </details>
      </div>
    </div>
  );
}
