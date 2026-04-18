import { RiAddLine, RiDeleteBinLine, RiPencilLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { Section } from "./Section";
import { PasskeyIcon } from "@/auth/PasskeyIcon";
import { authClient, signOut, useRequiredSession } from "@/auth/auth-client";
import { providersInfo } from "@/auth/providers";
import { authKeys } from "@/auth/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc";
import { usePageTitle } from "@/usePageTitle";

export default function SettingsAccountPage() {
  usePageTitle("Account settings");

  const { session: currentSession, user } = useRequiredSession();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [searchParams, setSearchParams] = useSearchParams();

  const [name, setName] = useState(user.name ?? "");
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState("");

  const [stravaStatus, setStravaStatus] = useState(() =>
    searchParams.get("strava"),
  );
  useEffect(() => {
    if (stravaStatus) {
      setSearchParams(
        p => {
          p.delete("strava");
          return p;
        },
        { replace: true },
      );
      if (stravaStatus === "connected") {
        queryClient.invalidateQueries({
          queryKey: trpc.strava.account.queryOptions().queryKey,
        });
      }
    }
  }, [stravaStatus, setSearchParams, queryClient, trpc]);

  const { data: accounts } = useQuery({
    queryKey: authKeys.accounts(),
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: authKeys.sessions(),
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw error;
      return data;
    },
  });

  const { data: passkeys } = useQuery({
    queryKey: authKeys.passkeys(),
    queryFn: async () => {
      const { data, error } = await authClient.passkey.listUserPasskeys();
      if (error) throw error;
      return data;
    },
  });

  const revokeSession = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });

  const updateName = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await authClient.updateUser({ name: newName });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });

  const unlinkAccount = useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await authClient.unlinkAccount({ providerId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.accounts() });
    },
  });

  const { data: stravaAccount } = useQuery(trpc.strava.account.queryOptions());

  const disconnectStrava = useMutation({
    ...trpc.strava.disconnect.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.accounts() });
      queryClient.invalidateQueries({
        queryKey: trpc.strava.account.queryOptions().queryKey,
      });
      setStravaStatus(null);
    },
  });

  const addPasskey = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.passkey.addPasskey();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.passkeys() });
    },
    throwOnError: false,
  });

  const deletePasskey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.passkeys() });
    },
  });

  const updatePasskey = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await authClient.passkey.updatePasskey({ id, name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.passkeys() });
      setEditingPasskeyId(null);
    },
  });

  const nameDirty = name !== (user.name ?? "");

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <Section title="Display name">
        <form
          onSubmit={e => {
            e.preventDefault();
            updateName.mutate(name);
          }}
          className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="max-w-xs flex-1"
          />
          <Button type="submit" disabled={!nameDirty || updateName.isPending}>
            Save
          </Button>
        </form>
        {updateName.isError && (
          <p className="text-destructive text-xs">
            {updateName.error?.message ?? "Failed to update name"}
          </p>
        )}
      </Section>

      <Section title="Integrations">
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
          <a href="/api/v1/strava/connect">
            <img
              src="/btn_strava_connect_with_orange.svg"
              alt="Connect with Strava"
              className="h-[48px]"
            />
          </a>
        )}
        {stravaStatus === "connected" && (
          <p className="mt-2 text-sm text-green-600">
            Strava connected successfully.
          </p>
        )}
        {stravaStatus === "denied" && (
          <p className="mt-2 text-sm text-gray-500">
            Strava connection cancelled.
          </p>
        )}
        {stravaStatus === "error" && (
          <p className="text-destructive mt-2 text-sm">
            Failed to connect Strava. Please try again.
          </p>
        )}
        {disconnectStrava.isError && (
          <p className="text-destructive mt-2 text-xs">
            {disconnectStrava.error?.message ?? "Failed to disconnect Strava"}
          </p>
        )}
      </Section>

      <Section
        title="Connected social accounts"
        description="The social accounts you use to sign in.">
        <ul className="flex flex-col gap-2">
          {accounts
            ?.filter(a => a.providerId !== "strava")
            .map(account => {
              const info =
                providersInfo[account.providerId as keyof typeof providersInfo];
              return (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    {info?.icon ?? null}
                    {info?.label ?? account.providerId}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unlinkAccount.mutate(account.providerId)}
                    disabled={unlinkAccount.isPending}>
                    Disconnect
                  </Button>
                </li>
              );
            })}
        </ul>
        {unlinkAccount.isError && (
          <p className="text-destructive mt-2 text-xs">
            {unlinkAccount.error?.message ?? "Failed to disconnect account"}
          </p>
        )}
        <p className="mt-4 text-sm text-gray-500">
          To link another social account, sign out and then sign in with a
          different social account that uses the same email address (
          {user.email}).
        </p>
      </Section>

      <Section
        title="Passkeys"
        description="Passkeys enable you to securely sign in using your device. Don't create passkeys on shared devices.">
        <ul className="flex flex-col gap-2">
          {passkeys?.map(passkey => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-4 text-sm text-gray-600">
              <div className="flex min-w-0 items-center gap-2">
                <PasskeyIcon className="h-4 w-4 shrink-0" />
                {editingPasskeyId === passkey.id ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      updatePasskey.mutate({
                        id: passkey.id,
                        name: editingPasskeyName,
                      });
                    }}
                    className="flex items-center gap-2">
                    <Input
                      value={editingPasskeyName}
                      onChange={e => setEditingPasskeyName(e.target.value)}
                      className="h-7 w-32 min-w-0 sm:w-48"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!editingPasskeyName || updatePasskey.isPending}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPasskeyId(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <span className="truncate">{passkey.name ?? passkey.id}</span>
                )}
              </div>
              {editingPasskeyId !== passkey.id && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPasskeyId(passkey.id);
                      setEditingPasskeyName(passkey.name ?? "");
                    }}>
                    <RiPencilLine className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePasskey.mutate(passkey.id)}
                    disabled={deletePasskey.isPending}>
                    <RiDeleteBinLine className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {deletePasskey.isError && (
          <p className="text-destructive mt-2 text-xs">
            {deletePasskey.error?.message ?? "Failed to delete passkey"}
          </p>
        )}
        {updatePasskey.isError && (
          <p className="text-destructive mt-2 text-xs">
            {updatePasskey.error?.message ?? "Failed to rename passkey"}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => addPasskey.mutate()}
          disabled={addPasskey.isPending}>
          <RiAddLine className="h-4 w-4" />
          Add passkey
        </Button>
        {addPasskey.isError && (
          // Note: The error.message contains no information for security
          <p className="text-destructive mt-2 text-xs">Failed to add passkey</p>
        )}
      </Section>

      <Section title="Sessions">
        <ul className="flex flex-col gap-2">
          {sessions?.map(session => {
            const isCurrent = session.token === currentSession.token;
            return (
              <li
                key={session.id}
                className="flex items-start justify-between gap-4 text-sm">
                <div className="flex min-w-0 flex-col">
                  <div className="flex min-w-0 items-center gap-2">
                    {isCurrent && (
                      <span className="shrink-0 text-xs font-medium text-green-600">
                        this device
                      </span>
                    )}
                    {session.userAgent && (
                      <span
                        className="truncate text-xs text-gray-600"
                        title={session.userAgent}>
                        {session.userAgent}
                      </span>
                    )}
                    {session.ipAddress && (
                      <span className="shrink-0 text-xs text-gray-600">
                        {session.ipAddress}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    <span>
                      Signed in{" "}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      Last seen{" "}
                      {new Date(session.updatedAt).toLocaleDateString()}{" "}
                      (approximate)
                    </span>
                    <span>
                      Expires {new Date(session.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {isCurrent ? (
                  <Button variant="outline" size="sm" onClick={() => signOut()}>
                    Sign out
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeSession.mutate(session.token)}
                    disabled={revokeSession.isPending}>
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Danger zone"
        description="Permanently delete your account and all associated data. This cannot be undone.">
        <p className="text-sm">
          I haven't implemented account deletion yet (this is a personal
          side-project). Please email me at{" "}
          <a href="mailto:daniel@plantopo.com" className="link">
            daniel@plantopo.com
          </a>{" "}
          to request manual account deletion.
        </p>
      </Section>
    </div>
  );
}
