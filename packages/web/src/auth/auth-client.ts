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
    __INITIAL_SESSION__?: unknown;
  }
}

export type Session = typeof authClient.$Infer.Session;

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) throw error;
      return data ?? null;
    },
    initialData: () => {
      const raw = window.__INITIAL_SESSION__;
      return raw ? (raw as Session) : null;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useRequiredSession() {
  const data = useSession().data;
  if (!data) throw new Error("Expected session");
  return data;
}

export function useUserPrefs(): UserPrefs {
  const sess = useSession();
  const value = sess.data?.user.prefs ?? {};
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
      await queryClient.cancelQueries({ queryKey: authKeys.session() });
      const previous = queryClient.getQueryData<Session | null>(
        authKeys.session(),
      );
      queryClient.setQueryData<Session | null>(authKeys.session(), old => {
        if (!old) return old;
        return { ...old, user: { ...old.user, prefs } };
      });
      return { previous };
    },
    onError: (_err, _prefs, context) => {
      queryClient.setQueryData(authKeys.session(), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
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
