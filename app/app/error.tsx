'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: Log the error to an error reporting service
    console.error(error);
  }, [error]);

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
          <summary>Technical info: Digest {error.digest}</summary>

          <pre>{error.message}</pre>

          <pre className="max-h-80 max-w-full overflow-auto">{error.stack}</pre>
        </details>
      </div>
    </div>
  );
}
