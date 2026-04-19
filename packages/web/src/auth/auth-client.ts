import { passkeyClient } from "@better-auth/passkey/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@pt/api";
import { type UserPrefs, UserPrefsSchema } from "@pt/shared";

import { authKeys } from "./queryKeys";

export const authClient = createAuthClient({
  baseURL: window.location.origin + "/api/v1/auth",
  plugins: [passkeyClient(), inferAdditionalFields<typeof auth>()],
});

declare global {
  interface Window {
    __INITIAL_USER__?: unknown;
  }
}

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

export function useSession(): Session["session"] | null {
  return (
    useQuery({
      queryKey: authKeys.session(),
      queryFn: async () => {
        const { data, error } = await authClient.getSession();
        if (error) throw error;
        return data?.session ?? null;
      },
      staleTime: 60 * 60 * 1000, // 1 hour
    }).data ?? null
  );
}

export function useUser(): User | null {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) throw error;
      return data?.user ?? null;
    },
    initialData: () => {
      const raw = window.__INITIAL_USER__;
      return raw ? (raw as User) : null;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  }).data;
}

export function useRequiredUser(): User {
  const user = useUser();
  if (!user) throw new Error("Expected user");
  return user;
}

export function useUserPrefs(): UserPrefs {
  const user = useUser();
  const value = user?.prefs ?? {};
  return UserPrefsSchema.parse(value);
}

export function useUserPrefsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: UserPrefs) => {
      const { error } = await authClient.updateUser({ prefs });
      if (error) throw error;
    },
    onMutate: async prefs => {
      await queryClient.cancelQueries({ queryKey: authKeys.user() });
      const previous = queryClient.getQueryData<User | null>(authKeys.user());
      queryClient.setQueryData<User | null>(authKeys.user(), old => {
        if (!old) return old;
        return { ...old, prefs };
      });
      return { previous };
    },
    onError: (_err, _prefs, context) => {
      queryClient.setQueryData(authKeys.user(), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

export function signOut() {
  if (window.Native) {
    window.Native.logout();
    return;
  }

  return authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/";
      },
    },
  });
}
