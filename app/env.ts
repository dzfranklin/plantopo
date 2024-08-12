const endpointEnv = process.env.NEXT_PUBLIC_API_ENDPOINT;
if (!endpointEnv) {
  throw new Error('Missing NEXT_PUBLIC_API_ENDPOINT');
}
export const API_ENDPOINT = endpointEnv.endsWith('/')
  ? endpointEnv
  : endpointEnv + '/';

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
}
