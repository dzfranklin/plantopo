import { AuthAcquireResponse } from '@/api/auth';
import { getUser } from '@workos-inc/authkit-nextjs';

export async function POST(_req: Request): Promise<Response> {
  const userInfo = await getUser();
  let resp: AuthAcquireResponse = null;
  if (userInfo.user) {
    resp = {
      user: {
        id: userInfo.user.id,
        email: userInfo.user.email,
        emailVerified: userInfo.user.emailVerified,
        profilePictureUrl: userInfo.user.profilePictureUrl,
        firstName: userInfo.user.firstName,
        lastName: userInfo.user.lastName,
        createdAt: userInfo.user.createdAt,
        updatedAt: userInfo.user.updatedAt,
      },
      accessToken: userInfo.accessToken,
    };
  }
  return new Response(JSON.stringify(resp), {
    headers: { 'content-type': 'application/json' },
  });
}
