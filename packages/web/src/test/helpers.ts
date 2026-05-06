import { commands } from "vitest/browser";

export async function readTestFile(
  path: string,
  options: FilePropertyBag & { name?: string } = {},
): Promise<File> {
  let { name, ...rest } = options;
  name ??= path.split("/").pop() ?? "file";

  const rawContents = await commands.readFile(path, "base64");

  // @ts-expect-error -- fromBase64 is Baseline 2025
  const contents = Uint8Array.fromBase64(rawContents);

  return new File([contents], name, rest);
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object | null
    ? T[K] extends null
      ? T[K]
      : DeepPartial<NonNullable<T[K]>> | null
    : T[K];
};

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: DeepPartial<T>,
): T {
  const result: T = { ...base };
  for (const key in overrides) {
    const k = key as keyof T & string;
    const overrideV = overrides[k];
    const baseV = result[k];
    if (
      overrideV !== null &&
      typeof overrideV === "object" &&
      !Array.isArray(overrideV) &&
      baseV !== null &&
      typeof baseV === "object" &&
      !Array.isArray(baseV)
    ) {
      result[k] = deepMerge(
        baseV as Record<string, unknown>,
        overrideV as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T & string];
    } else if (overrideV !== undefined) {
      result[k] = overrideV as T[keyof T & string];
    }
  }
  return result;
}
