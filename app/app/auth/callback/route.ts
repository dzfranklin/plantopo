import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

const handler = handleAuth();

export const GET = async (request: NextRequest) => {
  const { nextUrl, headers } = request;
  nextUrl.host = headers.get('Host') ?? nextUrl.host;

  // clear the port if not localhost
  if (!nextUrl.host.includes('localhost')) {
    nextUrl.port = '';
  }

  return handler(request);
};
