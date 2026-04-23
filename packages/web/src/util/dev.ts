import { readFile } from "node:fs/promises";
import { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(moduleDir, "..", "..");
const indexPath = path.join(root, "index.html");

export async function createDevMiddleware(httpServer: Server) {
  const vite = await createServer({
    root: root,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "custom",
  });

  async function getIndexHtml(url: string): Promise<string> {
    const raw = await readFile(indexPath, "utf-8");
    return vite.transformIndexHtml(url, raw);
  }

  return { middleware: vite.middlewares, getIndexHtml };
}
