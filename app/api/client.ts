'use client';

import { fetchClient } from './base';
import createClient from 'openapi-react-query';

export { fetchClient } from './base';

export const $api = createClient(fetchClient);
