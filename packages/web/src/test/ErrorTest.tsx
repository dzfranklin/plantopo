import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

export default function ErrorTest() {
  const trpc = useTRPC();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryKey = [["trpc"], ["ping-error-test"], { type: "query" }] as any;

  useSuspenseQuery({
    ...trpc.ping.queryOptions(),
    queryKey,
    retry: false,
  });

  return <div>Expecting error</div>;
}
