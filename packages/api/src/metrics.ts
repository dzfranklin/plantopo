import { createServer } from "http";

import { exportPrometheusMetrics } from "./jobs.js";
import { logger } from "./logger.js";
import { registry } from "./metrics-registry.js";

export function createMetricsServer() {
  return createServer(async (req, res) => {
    try {
      if (req.url === "/metrics") {
        const body = Buffer.from(await getMetrics(), "utf-8");
        res.writeHead(200, {
          "Content-Type": "text/plain",
          "Content-Length": body.length,
        });
        res.end(body);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    } catch (err) {
      logger.error({ err }, "Error handling metrics request");
      res.writeHead(500);
      res.end("Internal server error");
    }
  });
}

async function getMetrics(): Promise<string> {
  const [bullmq, app] = await Promise.all([
    exportPrometheusMetrics(),
    registry.metrics(),
  ]);
  return [bullmq, app].filter(Boolean).join("\n");
}
