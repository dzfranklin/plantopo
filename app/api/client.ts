'use client';

import createClient from './query';
import { fetchClient } from './base';

export { fetchClient } from './base';

export const $api = createClient(fetchClient);
