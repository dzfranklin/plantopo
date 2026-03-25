import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "../trpc.ts";

export default function Counter() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState(true);

  const { data: count } = useSuspenseQuery(trpc.counter.count.queryOptions());

  const setCount = useMutation(
    trpc.counter.setCount.mutationOptions({
      onMutate: async (newCount) => {
        if (!optimistic) return;
        await queryClient.cancelQueries(trpc.counter.count.queryFilter());
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
      onSuccess: (newCount) => {
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
    }),
  );

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-2xl font-semibold text-gray-800">Counter</h1>
      <span className="text-6xl font-bold tabular-nums text-gray-900">
        {count}
      </span>
      <button
        className="px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
        onClick={() => setCount.mutate(count + 1)}
        disabled={setCount.isPending}
      >
        Increment
      </button>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={optimistic}
          onChange={(e) => setOptimistic(e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        Optimistic update
      </label>
    </main>
  );
}
