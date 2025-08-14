import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const rulesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.rule.findMany({
      orderBy: { id: "asc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        conditionType: z.enum([
          "DESCRIPTION_CONTAINS",
          "DESCRIPTION_EXACT",
          "AMOUNT_EQUALS",
          "AMOUNT_GREATER_THAN",
          "AMOUNT_LESS_THAN",
        ]),
        conditionValue: z.string().min(1),
        actionCategoryId: z.number().int().positive().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.rule.create({
        data: {
          userId: ctx.auth.userId!,
          name: input.name,
          conditionType: input.conditionType,
          conditionValue: input.conditionValue,
          actionCategoryId: input.actionCategoryId ?? null,
          isActive: input.isActive ?? true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(128).optional(),
        conditionType: z
          .enum([
            "DESCRIPTION_CONTAINS",
            "DESCRIPTION_EXACT",
            "AMOUNT_EQUALS",
            "AMOUNT_GREATER_THAN",
            "AMOUNT_LESS_THAN",
          ])
          .optional(),
        conditionValue: z.string().min(1).optional(),
        actionCategoryId: z.number().int().positive().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.rule.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.rule.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
