export class AssertionError extends Error {}

export function assert(msg: string): never {
  throw new AssertionError(msg);
}

export function unreachable(msg?: string): never {
  assert(msg ? 'unreachable: ' + msg : 'unreachable');
}

export function unimplemented(msg?: string): never {
  assert(msg ? 'unimplemented: ' + msg : 'unimplemented');
}
