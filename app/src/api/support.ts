import wrapError from '@/generic/wrapError';
import { API_ENDPOINT } from './endpoint';
import { AppError, TransportError } from './errors';
import { ErrorReply, SuccessReply } from './reply';
import { v4 as uuidv4 } from 'uuid';

export async function performApi<TData>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: Array<string | number>,
  params?: Record<string, string>,
  body?: unknown,
): Promise<TData> {
  const requestId = uuidv4();

  const url = new URL(API_ENDPOINT);
  url.pathname += path.join('/');
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method,
      headers: {
        'X-Request-Id': requestId,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new TransportError(requestId, err);
  }

  if (!resp.headers.get('Content-Type')?.includes('application/json')) {
    let body: string;
    try {
      body = await resp.text();
    } catch (err) {
      throw new TransportError(requestId, err);
    }
    throw TransportError.notJson(requestId, resp.status, body);
  }

  if (resp.status === 500) {
    const body = await resp.text();
    throw new TransportError(
      requestId,
      wrapError(body, 'Internal server error'),
    );
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err) {
    throw new TransportError(requestId, err);
  }

  if (resp.ok) {
    return (json as SuccessReply<TData>).data;
  } else {
    const payload = json as ErrorReply;
    throw new AppError(requestId, payload);
  }
}
