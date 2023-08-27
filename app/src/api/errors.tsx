export class UnauthorizedError extends Error {
  readonly name = 'UnauthorizedError';
}

export class ForbiddenError extends Error {
  readonly name = 'ForbiddenError';
}

export class NotFoundError extends Error {
  readonly name = 'NotFoundError';
}

export class NetworkError extends Error {
  readonly name = 'NetworkError';

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : `${cause}`);
    this.stack = cause instanceof Error ? cause.stack : undefined;
  }
}
