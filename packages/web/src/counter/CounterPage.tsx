import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "../trpc.ts";
import { Button } from "@/components/ui/button.tsx";
import { usePageTitle } from "@/usePageTitle.ts";

export default function CounterPage() {
  usePageTitle("Counter");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState(true);

  const { data: count } = useSuspenseQuery(trpc.counter.count.queryOptions());

  const setCount = useMutation(
    trpc.counter.setCount.mutationOptions({
      onMutate: async newCount => {
        if (!optimistic) return;
        await queryClient.cancelQueries(trpc.counter.count.queryFilter());
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
      onSuccess: newCount => {
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
    }),
  );

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold text-gray-800">Counter</h1>
      <span className="text-6xl font-bold text-gray-900 tabular-nums">
        {count}
      </span>
      <Button
        onClick={() => setCount.mutate(count + 1)}
        disabled={setCount.isPending}
        size="lg">
        Increment
      </Button>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={optimistic}
          onChange={e => setOptimistic(e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Optimistic update
      </label>
    </main>
  );
}
