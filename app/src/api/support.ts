import wrapError from '@/generic/wrapError';
import {
  ForbiddenError,
  JsonDecodeError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
} from './errors';

export async function handleResp<T>(req: Promise<Response>): Promise<T> {
  let resp: Response;
  try {
    resp = await req;
  } catch (err) {
    throw new NetworkError(err);
  }

  if (resp.ok) {
    try {
      return await resp.json();
    } catch (err) {
      throw new JsonDecodeError(err);
    }
  } else {
    throw await respToError(resp);
  }
}

export async function respToError(resp: Response): Promise<Error> {
  let message: string | undefined;
  let cause: unknown;
  try {
    if (resp.headers.get('Content-Type')?.includes('application/json')) {
      const data = await resp.json();
      message = data.errors.message;
      cause = JSON.stringify(data);
    } else {
      cause = await resp.text();
    }
  } catch (err) {
    message = 'Error parsing error response';
    cause = err;
  }
  const inner = wrapError(cause, message || 'Error');

  if (resp.status === 401) {
    return new UnauthorizedError(message, { cause: inner });
  } else if (resp.status === 403) {
    return new ForbiddenError(message, { cause: inner });
  } else if (resp.status === 404) {
    return new NotFoundError(message, { cause: inner });
  } else {
    return inner;
  }
}
