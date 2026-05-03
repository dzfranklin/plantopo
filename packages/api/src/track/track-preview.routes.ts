import { type Request, type Response, Router } from "express";

import { requestContext } from "../request-context.js";
import { getRecordedTrackPreview } from "./track.service.js";

export function registerTrackPreviewRoutes(app: Router) {
  app.get(
    "/api/v1/track/:id/preview/:size",
    async (req: Request, res: Response) => {
      const user = requestContext().user;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id, size } = req.params as { id: string; size: string };

      if (size !== "large" && size !== "small") {
        res.status(404).json({ error: "Invalid size parameter" });
        return;
      }

      const data = await getRecordedTrackPreview(user.id, id, size);

      if (!data) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res
        .setHeader("Content-Type", "image/png")
        .setHeader("Cache-Control", "private, max-age=31536000, immutable")
        .send(data.buf);
    },
  );
}
