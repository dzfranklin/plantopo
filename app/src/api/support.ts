import { API_ENDPOINT } from './endpoint';
import { AppError, TransportError } from './errors';
import { ErrorReply, SuccessReply } from './reply';
import { v4 as uuidv4 } from 'uuid';

export async function handleResp<T>(req: Promise<Response>): Promise<T> {
  let resp: Response;
  try {
    resp = await req;

    if (resp.ok) {
      return await resp.json();
    } else {
      throw await respToError(resp);
    }
  } catch (err) {
    throw new TransportError('unspecified', err);
  }
}

export async function respToError(resp: Response): Promise<Error> {
  try {
    const json: ErrorReply = await resp.json();
    throw new AppError('unspecified', json);
  } catch (err) {
    throw new TransportError('unspecified', err);
  }
}

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
    if (payload.error.code === 500) {
      throw new TransportError(requestId, new AppError(requestId, payload));
    } else {
      throw new AppError(requestId, payload);
    }
  }
}
