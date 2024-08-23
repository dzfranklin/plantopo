import { AuthAcquireResponse } from './auth';

export async function acquireAccessToken(): Promise<string | null> {
  const res = await fetch('/auth/acquire', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Failed to acquire access token');
  }

  const data: AuthAcquireResponse = await res.json();

  if (data === null) {
    return null;
  } else {
    return data.accessToken;
  }
}
