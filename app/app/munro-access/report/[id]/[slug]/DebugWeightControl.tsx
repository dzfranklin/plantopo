import {
  ClusterScoreFeatures,
  clusterScoreFeaturesSchema,
} from '@/app/munro-access/report/[id]/[slug]/ranking';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';

export function DebugWeightControl({
  value,
  setValue,
}: {
  value: ClusterScoreFeatures;
  setValue: Dispatch<SetStateAction<ClusterScoreFeatures>>;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.value = JSON.stringify(value, null, 2);
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      <textarea
        defaultValue={JSON.stringify(value, null, 2)}
        ref={inputRef}
        rows={6}
      ></textarea>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <Button
        color="secondary"
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(input.value);
          } catch (err) {
            setErr(`${err}`);
            return;
          }

          const res = clusterScoreFeaturesSchema.safeParse(parsed);
          if (res.error) {
            setErr(res.error.toString());
            return;
          }

          setValue(res.data);
        }}
      >
        Update
      </Button>
    </div>
  );
}
