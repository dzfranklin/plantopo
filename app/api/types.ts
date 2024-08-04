import { z } from 'zod';

export class NetworkError extends Error {
  name = 'NetworkError';
  constructor(public options: FetchOptions<unknown>) {
    super('Network error');
  }
}

export class ServerError extends Error {
  name = 'ServerError';
  constructor(
    public options: FetchOptions<unknown>,
    public requestID: string,
    public response: Response,
    public body?: string,
  ) {
    super(
      `ServerError: ${response.status} ${response.statusText} ${response.url} [${requestID}]: ${body}`,
    );
  }

  get status() {
    return this.response.status;
  }
}

export class AuthorizationError extends Error {
  name = 'AuthorizationError';
  constructor(
    public options: FetchOptions<unknown>,
    public requestID: string,
  ) {
    super(`AuthorizationError: ${options.path} [${requestID}]`);
  }
}

export const ResponseSchema = z.object({
  data: z.unknown(),
});

export interface FetchOptions<T> {
  path: string;
  schema: Zod.Schema<T>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown> | FormData;
}
