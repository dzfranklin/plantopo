/** by is a sort helper. Usage: array.sort(by('key1', 'key2')) */
export function by(...keys: string[]) {
  return (a: Record<string, unknown>, b: Record<string, unknown>) => {
    let va;
    let vb;
    for (const key of keys) {
      va = a[key];
      if (va === undefined) continue;
      break;
    }
    for (const key of keys) {
      vb = b[key];
      if (vb === undefined) continue;
      break;
    }
    if ((va === undefined || va === null) && (vb === undefined || vb === null))
      return 0;
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  };
}
