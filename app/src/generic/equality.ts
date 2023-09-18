export function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a == null || b == null) {
    return false;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEq(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (!deepEq((a as any)[key], (b as any)[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

export function shallowArrayEq(a?: unknown[], b?: unknown[]): boolean {
  if (a === b) {
    return true;
  }

  if (a === null) return b === null;
  if (b === null) return false;
  if (a === undefined) return b === undefined;
  if (b === undefined) return false;

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}
