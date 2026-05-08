import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import type { StravaConnectionResult } from "@pt/api";

import { SettingsSection } from "./SettingsSection";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc";

export default function SettingsIntegrationsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const stravaResult = searchParams.get(
    "strava_result",
  ) as StravaConnectionResult | null;

  const { data: stravaAccount } = useQuery(trpc.strava.account.queryOptions());

  const disconnectStrava = useMutation(
    trpc.strava.disconnect.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.strava.pathFilter());
      },
    }),
  );

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <SettingsSection title="Strava">
        <div>
          {stravaAccount ? (
            <div className="flex items-center justify-between gap-4 text-sm text-gray-600">
              <span>
                <img
                  src={stravaAccount.athlete.profile}
                  className="mr-4 inline-block h-8 w-8"
                />{" "}
                Connected to Strava ({stravaAccount.athlete.firstname}{" "}
                {stravaAccount.athlete.lastname})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectStrava.mutate()}
                disabled={disconnectStrava.isPending}>
                Disconnect
              </Button>
            </div>
          ) : (
            <ConnectWithStravaButton />
          )}

          {stravaResult && disconnectStrava.isIdle && (
            <StravaResultMessage result={stravaResult} />
          )}

          {disconnectStrava.isError && (
            <p className="text-destructive mt-2 text-xs">
              {disconnectStrava.error?.message ?? "Failed to disconnect Strava"}
            </p>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

function StravaResultMessage({ result }: { result: StravaConnectionResult }) {
  if (result === "connected") {
    return (
      <p className="mt-2 text-sm text-green-600">
        Strava connected successfully.
      </p>
    );
  } else if (result === "denied") {
    return (
      <p className="mt-2 text-sm text-gray-500">Strava connection cancelled.</p>
    );
  } else if (result === "error") {
    return (
      <p className="text-destructive mt-2 text-sm">
        Failed to connect Strava. Please try again.
      </p>
    );
  } else {
    return null;
  }
}

export function ConnectWithStravaButton() {
  return (
    <a href="/api/v1/strava/connect" className="block">
      <img
        src="/btn_strava_connect_with_orange.svg"
        alt="Connect with Strava"
        className="h-[48px]"
      />
    </a>
  );
}
