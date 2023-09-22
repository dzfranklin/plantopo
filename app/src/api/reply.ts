export interface SuccessReply<T> {
  data: T;
}

export interface ErrorReply<TDetails = unknown> {
  error: {
    code: number;
    reason?: string;
    message?: string;
    details?: TDetails;
  };
}
