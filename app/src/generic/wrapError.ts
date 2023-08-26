export default function wrapError(error: unknown, message: string) {
  let inner;
  if (error instanceof Error) inner = error;
  if (typeof error === 'string') inner = new Error(error);
  else inner = new Error(JSON.stringify(error));
  return new Error(message, { cause: inner });
}
