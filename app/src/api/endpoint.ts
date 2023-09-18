const base = process.env.NEXT_PUBLIC_API_ENDPOINT;
if (!base) {
  throw new Error('NEXT_PUBLIC_API_ENDPOINT is not set');
}
if (base.endsWith('/')) {
  throw new Error(`NEXT_PUBLIC_API_ENDPOINT not end with / (got ${base})`);
}
try {
  new URL(base);
} catch (err) {
  throw new Error(`NEXT_PUBLIC_API_ENDPOINT is not a valid URL (got ${base})`);
}

export const API_ENDPOINT = base + '/api/v1/';
export const API_ENDPOINT_WS = base.replace(/^http/, 'ws') + '/api/v1/';
