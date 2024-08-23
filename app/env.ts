const endpointEnv = process.env.NEXT_PUBLIC_API_ENDPOINT;
if (!endpointEnv) {
  throw new Error('Missing NEXT_PUBLIC_API_ENDPOINT');
}
export const API_ENDPOINT = endpointEnv.endsWith('/')
  ? endpointEnv
  : endpointEnv + '/';

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!mapboxToken) {
  throw new Error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
}
export const MAPBOX_TOKEN: string = mapboxToken;
