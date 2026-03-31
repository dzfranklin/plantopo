import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authClient, signOut, useRequiredSession } from "@/auth/auth-client";
import { providersInfo } from "@/auth/providers";
import { authKeys } from "@/auth/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/usePageTitle";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <hr className="my-2" />
        {description && (
          <p className="mb-2 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function SettingsAccountPage() {
  usePageTitle("Account settings");

  const { session: currentSession, user } = useRequiredSession();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user.name ?? "");

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

  const nameDirty = name !== (user.name ?? "");

  return (
    <div className="flex flex-col gap-10">
      <Section title="Display name">
        <form
          onSubmit={e => {
            e.preventDefault();
            updateName.mutate(name);
          }}
          className="flex items-center gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="max-w-xs"
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

      <Section
        title="Connected social accounts"
        description="The social accounts you use to sign in.">
        <ul className="flex flex-col gap-2">
          {accounts?.map(account => {
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

      <Section title="Sessions">
        <ul className="flex flex-col gap-2">
          {sessions?.map(session => {
            const isCurrent = session.token === currentSession.token;
            return (
              <li
                key={session.id}
                className="flex items-start justify-between gap-4 text-sm">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="shrink-0 text-xs font-medium text-green-600">
                        this device
                      </span>
                    )}
                    {session.userAgent && (
                      <span
                        className="shrink truncate text-xs text-gray-600"
                        title={session.userAgent}>
                        {session.userAgent}
                      </span>
                    )}
                    {session.ipAddress && (
                      <span className="text-xs text-gray-600">
                        {session.ipAddress}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400">
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
