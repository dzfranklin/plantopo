export class AssertionError extends Error {}

export function unreachable(msg?: string): never {
  throw new AssertionError(msg ? 'unreachable: ' + msg : 'unreachable');
}

export function unimplemented(msg?: string): never {
  throw new AssertionError(msg ? 'unimplemented: ' + msg : 'unimplemented');
}
