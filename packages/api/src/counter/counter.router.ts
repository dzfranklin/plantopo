import z from "zod";

import { authedProcedure, router } from "../trpc.js";
import { getCount, setCount } from "./counter.service.js";

export const counterRouter = router({
  count: authedProcedure.query(() => getCount()),
  setCount: authedProcedure
    .input(z.number())
    .mutation(({ input }) => setCount(input)),
});
