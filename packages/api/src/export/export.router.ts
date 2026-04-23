import { env } from "../env.js";
import { authedProcedure, router } from "../trpc.js";
import { generateExport } from "./export.service.js";

export const exportRouter = router({
  generate: authedProcedure.mutation(async ({ ctx }) => {
    const id = await generateExport(ctx.session.user.id);
    return {
      downloadName: id + ".zip",
      downloadURL: `${env.APP_URL}/api/v1/export/${id}.zip`,
    };
  }),
});
