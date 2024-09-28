export type PageSearchParams = { [key: string]: string | string[] | undefined };

export function searchParamValue(
  params: PageSearchParams,
  key: string,
): string | undefined {
  return firstValueOf(params[key]);
}

export function pageSearchParams(params: PageSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = firstValueOf(v);
    if (value !== undefined) {
      out.set(k, value);
    }
  }
  return out;
}

function firstValueOf(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    if (value.length > 0) {
      return value[0]!;
    } else {
      return;
    }
  } else {
    return value;
  }
}
