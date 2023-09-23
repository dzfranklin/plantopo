const envVar = process.env.NEXT_PUBLIC_API_ENDPOINT;
if (!envVar) {
  throw new Error('NEXT_PUBLIC_API_ENDPOINT is not set');
}
if (!envVar.endsWith('/')) {
  throw new Error(`NEXT_PUBLIC_API_ENDPOINT must end with / (got ${envVar})`);
}
try {
  new URL(envVar);
} catch (err) {
  throw new Error(
    `NEXT_PUBLIC_API_ENDPOINT is not a valid URL (got ${envVar})`,
  );
}

export const API_ENDPOINT = envVar;
export const API_ENDPOINT_WS = API_ENDPOINT.replace(/^http/, 'ws');
