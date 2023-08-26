import { ActionButton } from '@adobe/react-spectrum';
import { useMemo } from 'react';

/** Displays technical information suitable for showing to the user so that it
 * can be reported to us */
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
    <details className="prose">
      <summary className="text-sm">Technical Information</summary>

      <pre>
        <code>{json}</code>
      </pre>

      <ActionButton onPress={() => console.info({ error })}>
        Log to console
      </ActionButton>
    </details>
  );
}
