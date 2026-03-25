import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "../index.html");

export async function createDevMiddleware() {
  const vite = await createServer({
    root: resolve(__dirname, ".."),
    server: { middlewareMode: true },
    appType: "custom",
  });

  async function getIndexHtml(url: string): Promise<string> {
    const raw = await readFile(indexPath, "utf-8");
    return vite.transformIndexHtml(url, raw);
  }

  return { middleware: vite.middlewares, getIndexHtml };
}
