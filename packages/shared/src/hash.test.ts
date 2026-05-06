import { describe, expect, it, test } from "vitest";

import { sha256 } from "./hash.js";

// Generated using `printf "test" | sha256"
const cases: [string | BufferSource, string][] = [
  ["test", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"],
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [
    new TextEncoder().encode("test"),
    "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  ],
];

test.for(cases)("hashes %o to %s", async ([input, expected]) => {
  const result = await sha256(input);
  expect(result).toBe(expected);
});

it("accepts multiple inputs", async () => {
  expect(await sha256("foo", "bar")).toBe(await sha256("foobar"));
});

describe("inputToBuffers", async () => {
  const { inputToBuffers } = (await import("./hash.js")).exportedForTesting;

  it("flattens nested inputs in order", async () => {
    expect(
      inputToBuffers([
        ["foo", "bar"],
        ["baz", ["qux"]],
      ]),
    ).toEqual(inputToBuffers(["foo", "bar", "baz", "qux"]));
  });
});
