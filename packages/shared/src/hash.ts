// Uses Web Crypto API, which is available in modern Node.js
declare type BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer;
declare const crypto: { subtle: SubtleCrypto };
declare class SubtleCrypto {
  digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer>;
}
declare class TextEncoder {
  encode(input: string): Uint8Array<ArrayBuffer>;
}

export type HashInput = string | BufferSource | Iterable<HashInput>;

export async function sha256(...data: HashInput[]): Promise<string> {
  const inputs = data.flatMap(inputToBuffers);
  const inputLength = inputs.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(inputLength);
  let offset = 0;
  for (const buf of inputs) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function inputToBuffers(data: HashInput): ArrayBuffer[] {
  if (typeof data === "string") {
    return [new TextEncoder().encode(data).buffer];
  } else if (data instanceof ArrayBuffer) {
    return [data];
  } else if (ArrayBuffer.isView(data)) {
    return [data.buffer];
  } else if (Symbol.iterator in Object(data)) {
    return Array.from(data).flatMap(inputToBuffers);
  } else {
    throw new TypeError("Invalid hash input");
  }
}

export const exportedForTesting = {
  inputToBuffers,
};
