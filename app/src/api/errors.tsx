export class UnauthorizedError extends Error {
  readonly name = 'UnauthorizedError';
}

export class ForbiddenError extends Error {
  readonly name = 'ForbiddenError';
}

export class NotFoundError extends Error {
  readonly name = 'NotFoundError';
}
