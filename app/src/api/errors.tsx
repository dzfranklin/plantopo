import { ErrorReply } from './reply';

export type ApiError<TDetails = unknown> = TransportError | AppError<TDetails>;

export class TransportError extends Error {
  readonly name = 'TransportError';

  constructor(
    public requestId: string,
    public cause: unknown,
  ) {
    const errCause = cause instanceof Error ? cause : new Error(`${cause}`);
    super(`${errCause.message} (requestId: ${requestId})`);
  }

  static notJson(requestId: string, status: number, _body: string) {
    return new TransportError(
      requestId,
      new Error(`not json (status ${status}`),
    );
  }
}

export class AppError<TDetails> extends Error {
  readonly name = 'AppError';

  readonly code: number;
  readonly reason?: string;
  readonly details?: TDetails;

  constructor(
    public requestId: string,
    public cause: ErrorReply<TDetails>,
  ) {
    const msg = cause.error.message || `Error ${cause.error.code}`;
    super(`${msg} (requestId: ${requestId})`);
    this.code = cause.error.code;
    this.reason = cause.error.reason;
    this.details = cause.error.details;
  }
}
