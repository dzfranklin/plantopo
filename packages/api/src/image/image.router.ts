import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { db } from "../db.js";
import { authedProcedure, router } from "../trpc.js";
import { image } from "./image.schema.js";
import {
  confirmUpload,
  deleteImage,
  listImagesByUser,
  requestUpload,
  unlinkImageFromTrack,
} from "./image.service.js";

export const imageRouter = router({
  requestUpload: authedProcedure
    .input(
      z.object({
        linkedTrackId: z.string().optional(),
        sha256: z.string().length(64),
        mimeType: z.string(),
        size: z.number().int().positive(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        takenAt: z.string().optional(),
        location: z.object({ lat: z.number(), lng: z.number() }).optional(),
        exif: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return requestUpload(ctx.user.id, input);
    }),

  confirmUpload: authedProcedure
    .input(z.object({ s3Key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .select({ userId: image.userId })
        .from(image)
        .where(eq(image.s3Key, input.s3Key));

      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await confirmUpload(input.s3Key);
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return listImagesByUser(ctx.user.id);
  }),

  delete: authedProcedure
    .input(z.object({ s3Key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .select({ userId: image.userId })
        .from(image)
        .where(eq(image.s3Key, input.s3Key));

      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await deleteImage(input.s3Key);
    }),

  unlinkFromTrack: authedProcedure
    .input(z.object({ s3Key: z.string(), trackId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .select({ userId: image.userId })
        .from(image)
        .where(eq(image.s3Key, input.s3Key));

      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await unlinkImageFromTrack(input.s3Key, input.trackId);
    }),
});
