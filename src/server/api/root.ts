import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { transactionsRouter } from "@/server/api/routers/transactions";
import { categoriesRouter } from "@/server/api/routers/categories";
import { rulesRouter } from "@/server/api/routers/rules";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  transactions: transactionsRouter,
  categories: categoriesRouter,
  rules: rulesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
