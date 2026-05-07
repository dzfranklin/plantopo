import fs from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import z from "zod";

import { sha256 } from "@pt/shared";

const realFetch = globalThis.fetch;

async function urlToFixtureName(
  method: string,
  input: string | URL,
): Promise<string> {
  const url = input instanceof URL ? input : new URL(input);
  const path = url.pathname.replace(/^\/+/, "");
  const slug = path
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
  const hash = (await sha256(method, url.toString())).slice(0, 8);
  return `${method.toUpperCase()}_${slug}_${hash}.json`;
}

const FixtureEntrySchema = z.object({
  url: z.string(),
  method: z.string(),
  status: z.number(),
  headers: z.record(z.string(), z.string()),
  body: z.unknown().optional(),
  bodyText: z.string().optional(),
});

type FixtureEntry = z.infer<typeof FixtureEntrySchema>;

export function makeFixtureFetch(fixturesDir: string): typeof fetch {
  const recordMissing = !!process.env.RECORD_FIXTURES;
  const recordAll = process.env.RECORD_FIXTURES === "all";

  return async (input, init) => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : input;
    const method = (
      (input instanceof Request ? input.method : init?.method) ?? "GET"
    ).toUpperCase();

    const fixturePath = join(fixturesDir, await urlToFixtureName(method, url));

    const existing = await fs.readFile(fixturePath, "utf8").catch(() => null);
    const recordThis = recordAll || (recordMissing && !existing);

    if (!recordThis) {
      if (!existing) {
        throw new Error(
          `No fixture for ${method} ${url}\n` +
            `Run with RECORD_FIXTURES=1 to record it.\n` +
            `Expected: ${fixturePath}`,
        );
      }

      const entry = FixtureEntrySchema.parse(
        JSON.parse(await readFile(fixturePath, "utf8")),
      );

      if (entry.url !== url || entry.method !== method) {
        throw new Error(
          `Fixture mismatch for ${method} ${url}\n` +
            `Expected ${entry.method} ${entry.url}`,
        );
      }

      console.info(
        `Using fixture for ${method} ${url} (${entry.status}) - ${fixturePath}`,
      );
      if (entry.bodyText) {
        return new Response(entry.bodyText, { status: entry.status });
      } else {
        return new Response(JSON.stringify(entry.body), {
          status: entry.status,
          headers: entry.headers,
        });
      }
    }

    console.info(`Recording fixture for ${method} ${url}`);
    const response = await realFetch(input, init);
    const clone = response.clone();

    let body: unknown = undefined;
    let bodyText: string | undefined = undefined;
    try {
      body = await clone.json();
    } catch {
      bodyText = await clone.text();
    }
    const entry: FixtureEntry = {
      url,
      method,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      bodyText,
    };

    await writeFile(fixturePath, JSON.stringify(entry, null, 2) + "\n");
    console.info(`Fixture recorded: ${fixturePath} (${response.status})`);
    return response;
  };
}
