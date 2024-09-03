import { API_ENDPOINT } from '@/env';
import createFetchClient from 'openapi-fetch';
import type { paths } from './v1';

export const fetchClient = createFetchClient<paths>({
  baseUrl: API_ENDPOINT,
  credentials: 'include',
});
