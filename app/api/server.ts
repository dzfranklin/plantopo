import { API_ENDPOINT } from '@/env';
import createFetchClient from 'openapi-fetch';
import type { paths } from './v1';
import createClient from './query';

export const fetchClient = createFetchClient<paths>({ baseUrl: API_ENDPOINT });
export const $api = createClient(fetchClient);
