import { FetchOptions } from './types';
import { baseApiFetch } from './baseFetch';
import { acquireAccessToken } from './clientAuth';

export async function apiFetch<T>(options: FetchOptions<T>): Promise<T> {
  const maybeAccessToken = await acquireAccessToken();
  return baseApiFetch({
    ...options,
    accessToken: maybeAccessToken ?? undefined,
  });
}
