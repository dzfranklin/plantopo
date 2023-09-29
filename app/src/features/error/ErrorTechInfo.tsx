import { useMemo } from 'react';

/** Displays technical information suitable for showing to the user so that it
 * can be reported to us.
 *
 * NOTE: Must not depend on being run in any provider so that we can use in an
 * any error boundary. In particular this means it can't use spectrum components. */
export default function ErrorTechInfo({ error }: { error: unknown }) {
  const json = useMemo(() => {
    return JSON.stringify(
      error,
      (k, v) => {
        if (v instanceof Error) {
          return {
            ...v,
            name: v.name,
            message: v.message,
            cause: v.cause,
          };
        } else {
          return v;
        }
      },
      2,
    );
  }, [error]);

  return (
    <details className="my-1 prose">
      <summary className="text-sm">Technical Information</summary>

      <pre>
        <code>{json}</code>
      </pre>

      <button
        type="button"
        className="px-2 py-1 text-xs font-semibold text-gray-900 bg-white rounded shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        onClick={() => console.info({ error })}
      >
        Log to console
      </button>
    </details>
  );
}
