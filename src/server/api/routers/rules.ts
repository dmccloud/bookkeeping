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

  applyToUncategorized: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.auth.userId!;
    const rules = await ctx.db.rule.findMany({
      where: { userId, isActive: true },
      orderBy: { id: "asc" },
    });

    const normalize = (s: string) =>
      s.trim().toLowerCase().replace(/\s+/g, " ");
    const applyRulesLocal = (item: { description: string; amount: number }) => {
      const desc = normalize(item.description);
      for (const r of rules) {
        switch (r.conditionType) {
          case "DESCRIPTION_CONTAINS":
            if (desc.includes(r.conditionValue.toLowerCase()))
              return r.actionCategoryId ?? undefined;
            break;
          case "DESCRIPTION_EXACT":
            if (desc === r.conditionValue.toLowerCase())
              return r.actionCategoryId ?? undefined;
            break;
          case "AMOUNT_EQUALS":
            if (item.amount === Number(r.conditionValue))
              return r.actionCategoryId ?? undefined;
            break;
          case "AMOUNT_GREATER_THAN":
            if (item.amount > Number(r.conditionValue))
              return r.actionCategoryId ?? undefined;
            break;
          case "AMOUNT_LESS_THAN":
            if (item.amount < Number(r.conditionValue))
              return r.actionCategoryId ?? undefined;
            break;
        }
      }
      return undefined;
    };

    const batchSize = 1000;
    let cursorId: number | undefined = undefined;
    let totalUpdated = 0;
    // Process in batches to avoid loading everything at once
    while (true) {
      const txs = await ctx.db.transaction.findMany({
        where: { userId, categoryId: null },
        take: batchSize,
        ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
        orderBy: { id: "asc" },
        select: { id: true, description: true, amount: true },
      });
      if (txs.length === 0) break;
      cursorId = txs[txs.length - 1]!.id;

      for (const t of txs) {
        const catId = applyRulesLocal({
          description: t.description,
          amount: Number(t.amount),
        });
        if (!catId) continue;
        await ctx.db.transaction.update({
          where: { id: t.id },
          data: { categoryId: catId },
        });
        totalUpdated += 1;
      }
    }

    return { updated: totalUpdated };
  }),
});
