import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createDevMiddleware() {
  const vite = await createServer({
    root: resolve(__dirname, ".."),
    server: { middlewareMode: true },
    appType: "spa",
  });
  return vite.middlewares;
}
