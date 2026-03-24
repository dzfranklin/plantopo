import z from "zod";

import { publicProcedure, router } from "../trpc.js";
import { getCount, setCount } from "./counter.service.js";

export const counterRouter = router({
  count: publicProcedure.query(() => getCount()),
  setCount: publicProcedure
    .input(z.number())
    .mutation(({ input }) => setCount(input)),
});
