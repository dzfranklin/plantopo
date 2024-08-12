import { z } from 'zod';

export const UserInfoSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    profilePictureUrl: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  accessToken: z.string(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

export const AuthAcquireResponseSchema = z.union([UserInfoSchema, z.null()]);

export type AuthAcquireResponse = z.infer<typeof AuthAcquireResponseSchema>;
