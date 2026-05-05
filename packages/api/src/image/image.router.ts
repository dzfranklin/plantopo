import { TRPCError } from "@trpc/server";
import z from "zod";

import { authedProcedure, router } from "../trpc.js";
import {
  ConfirmUploadResponseSchema,
  RequestUploadResponseSchema,
  RequestUploadSchema,
  confirmUpload,
  deleteImage,
  isImageOwnedBy,
  listImagesByUser,
  requestUpload,
  unlinkImageFromTrack,
} from "./image.service.js";

export const imageRouter = router({
  requestUpload: authedProcedure
    .input(RequestUploadSchema)
    .output(RequestUploadResponseSchema)
    .mutation(async ({ input, ctx }) => {
      return requestUpload(ctx.user.id, input);
    }),

  confirmUpload: authedProcedure
    .input(z.object({ s3Key: z.string() }))
    .output(ConfirmUploadResponseSchema)
    .mutation(async ({ input: { s3Key }, ctx }) => {
      if (!(await isImageOwnedBy({ s3Key, userId: ctx.user.id }))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return await confirmUpload(s3Key);
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return listImagesByUser(ctx.user.id);
  }),

  delete: authedProcedure
    .input(z.object({ s3Key: z.string() }))
    .mutation(async ({ input: { s3Key }, ctx }) => {
      if (!(await isImageOwnedBy({ s3Key, userId: ctx.user.id }))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await deleteImage(s3Key);
    }),

  unlinkFromTrack: authedProcedure
    .input(z.object({ s3Key: z.string(), trackId: z.string() }))
    .mutation(async ({ input: { s3Key, trackId }, ctx }) => {
      if (!(await isImageOwnedBy({ s3Key, userId: ctx.user.id }))) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await unlinkImageFromTrack(s3Key, trackId);
    }),
});
