'use client';

import { API_ENDPOINT } from '@/env';
import createFetchClient from 'openapi-fetch';
import createClient from './query';
import type { paths } from './v1';

export const fetchClient = createFetchClient<paths>({ baseUrl: API_ENDPOINT });
export const $api = createClient(fetchClient);
