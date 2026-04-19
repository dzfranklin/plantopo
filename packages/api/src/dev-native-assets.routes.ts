import type express from "express";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { getLog } from "./logger.js";

const ASSET_PATH = join(
  process.cwd(),
  "packages/web/dist/native-assets.tar.gz",
);

let etag: string | null = null;
let generating: Promise<void> | null = null;

async function generate() {
  if (generating) return generating;
  generating = (async () => {
    getLog().info("Generating native assets...");
    await new Promise<void>((resolve, reject) => {
      exec("npm run build -w @pt/web", err => (err ? reject(err) : resolve()));
    });
    getLog().info("Generated native assets");
    etag = randomUUID();
  })();
  try {
    await generating;
  } finally {
    generating = null;
  }
}

export function registerDevNativeAssetsRoutes(app: express.Express) {
  app.head("/native-assets.tar.gz", async (req, res, next) => {
    try {
      if (!etag) await generate();
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("ETag", etag!);
      res.status(200).end();
    } catch (e) {
      next(e);
    }
  });

  app.get("/native-assets.tar.gz", async (req, res, next) => {
    try {
      if (!etag) await generate();
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("ETag", etag!);
      res.sendFile(ASSET_PATH);
    } catch (e) {
      next(e);
    }
  });
}
