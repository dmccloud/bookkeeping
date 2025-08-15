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
      const name = input.name.trim();
      const nameNormalized = normalizeCategoryName(name);
      return ctx.db.category.upsert({
        where: { nameNormalized },
        update: {},
        create: { name, nameNormalized },
      });
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      const nameNormalized = normalizeCategoryName(name);
      return ctx.db.category.update({
        where: { id: input.id },
        data: { name, nameNormalized },
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

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
