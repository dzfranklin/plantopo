import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type AuthUser = z.infer<typeof userSchema>;

declare global {
  interface Window {
    __USER__?: unknown;
  }
}

export function getUser(): AuthUser | null {
  return window.__USER__ ? userSchema.parse(window.__USER__) : null;
}
