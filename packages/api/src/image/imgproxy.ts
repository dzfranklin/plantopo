import type { Options } from "@imgproxy/imgproxy-js-core";
import { generateImageUrl } from "@imgproxy/imgproxy-node";

import { env } from "../env.js";
import type { ImageSrc } from "../index.js";

export function imgproxy(
  url: string,
  opts: Options & { width: number; height: number; maxSize?: number },
): ImageSrc {
  let { width, height, maxSize, ...rest } = opts;
  if (maxSize !== undefined && Math.max(width, height) > maxSize) {
    const scale = maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  return {
    src: generateImgproxyUrl(url, { ...rest, width, height, dpr: 2 }),
    width,
    height,
  };
}

export function generateImgproxyUrl(url: string, opts: Options = {}): string {
  return generateImageUrl({
    endpoint: env.IMGPROXY_BASE_URL,
    key: env.IMGPROXY_KEY,
    salt: env.IMGPROXY_SALT,
    url: { value: url, displayAs: "base64" },
    options: opts,
  });
}

export function generateImgproxyRawUrl(url: string, filename: string): string {
  const base = generateImgproxyUrl(url, { raw: true });
  return base + "?" + new URLSearchParams({ filename }).toString();
}

export function urlSafeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return Buffer.from(bytes).toString("base64url");
}
