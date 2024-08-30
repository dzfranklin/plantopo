'use server';

import { FetchOptions } from './types';
import { baseApiFetch } from './baseFetch';

export async function apiFetch<T>(options: FetchOptions<T>): Promise<T> {
  const user: { accessToken?: string } = {}; // TODO
  try {
    return await baseApiFetch({
      ...options,
      accessToken: 'accessToken' in user ? user.accessToken : undefined,
    });
  } catch (err) {
    console.log(err);
    throw err;
  }
}
