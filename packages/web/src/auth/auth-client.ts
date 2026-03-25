import { useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  { baseURL: window.location.origin + "/api/v1/auth" },
);

declare global {
  interface Window {
    __INITIAL_SESSION__?: unknown;
  }
}

type Session = typeof authClient.$Infer.Session;

export function useSession() {
  return useQuery({
    queryKey: ["session"],
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
