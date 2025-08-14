import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const categoriesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.create({ data: { name: input.name } });
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      // Note: If there are transactions referencing this category, this may fail due to FK.
      // In a real app, we'd prevent deletion or reassign.
      await ctx.db.category.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
