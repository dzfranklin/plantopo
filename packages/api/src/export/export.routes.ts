import { type Request, type Response, Router } from "express";
import os from "node:os";
import path from "node:path";

export function registerExportRoutes(app: Router) {
  app.get("/api/v1/export/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const filePath = path.resolve(path.join(os.tmpdir(), id));
    if (!filePath.startsWith(os.tmpdir())) {
      res.status(400).send("Invalid export ID");
      return;
    }

    res.sendFile(filePath, err => {
      if (err) {
        res.status(404).send("Export not found");
      }
    });
  });
}
