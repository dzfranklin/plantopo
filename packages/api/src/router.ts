import { counterRouter } from "./counter/counter.router.js";
import { router } from "./trpc.js";

export const appRouter = router({
  counter: counterRouter,
});

export type AppRouter = typeof appRouter;
