import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { Prisma } from "@prisma/client";

const paginationInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(500).default(50),
  categoryId: z.number().int().positive().nullable().optional(),
  flagged: z.boolean().optional(),
  uncategorized: z.boolean().optional(),
  search: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const transactionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const {
        page,
        pageSize,
        categoryId,
        flagged,
        uncategorized,
        search,
        dateFrom,
        dateTo,
      } = input;
      const where: Prisma.TransactionWhereInput = { userId: ctx.auth.userId! };
      if (categoryId !== undefined && categoryId !== null) {
        where.categoryId = categoryId;
      }
      if (flagged !== undefined) where.isFlagged = flagged;
      if (uncategorized) where.categoryId = null;
      if (search) where.description = { contains: search, mode: "insensitive" };
      if (dateFrom || dateTo)
        where.date = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };

      try {
        const [items, total] = await Promise.all([
          ctx.db.transaction.findMany({
            where,
            orderBy: { date: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          ctx.db.transaction.count({ where }),
        ]);

        return {
          items,
          page,
          pageSize,
          total,
        };
      } catch (err) {
        console.error(err);
        return {
          items: [],
          total: 0,
        };
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        date: z.string().datetime(),
        description: z.string().min(0),
        amount: z.number(),
        categoryId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const duplicateKey = buildDuplicateKey(
        input.description,
        input.date,
        input.amount,
      );
      const { isFlagged, flagReason } = evaluateAnomalies(
        input.description,
        input.amount,
      );
      return ctx.db.transaction.create({
        data: {
          userId: ctx.auth.userId!,
          date: new Date(input.date),
          description: input.description,
          amount: input.amount,
          categoryId: input.categoryId!,
          duplicateKey,
          isFlagged,
          flagReason,
        },
      });
    }),

  createMany: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              date: z.string().datetime(),
              description: z.string().min(0),
              amount: z.number(),
              categoryId: z.number().int().positive().nullable().optional(),
            }),
          )
          .min(1),
        defaultCategoryId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId!;

      const rules = await ctx.db.rule.findMany({
        where: { userId, isActive: true },
        orderBy: { id: "asc" },
      });

      const prepared = input.items.map((it) => {
        const duplicateKey = buildDuplicateKey(
          it.description,
          it.date,
          it.amount,
        );
        const ruleCategoryId = applyRules(it, rules);
        const anomalies = evaluateAnomalies(it.description, it.amount);
        return {
          userId,
          date: new Date(it.date),
          description: it.description,
          amount: it.amount,
          categoryId: (it.categoryId ??
            ruleCategoryId ??
            input.defaultCategoryId)!,
          duplicateKey,
          isFlagged: anomalies.isFlagged,
          flagReason: anomalies.flagReason,
        } as const;
      });

      // filter within-batch duplicates by duplicateKey
      const seen = new Set<string>();
      const batchUnique = prepared.filter((p) => {
        if (!p.duplicateKey) return true;
        if (seen.has(p.duplicateKey)) return false;
        seen.add(p.duplicateKey);
        return true;
      });

      // filter already-existing duplicates
      const keys = batchUnique
        .map((b) => b.duplicateKey)
        .filter((key): key is string => Boolean(key));
      const existing = keys.length
        ? await ctx.db.transaction.findMany({
            where: { userId, duplicateKey: { in: keys } },
            select: { duplicateKey: true },
          })
        : [];
      const existingSet = new Set(
        existing.map((e) => e.duplicateKey).filter(Boolean),
      );
      const toInsert = batchUnique.filter(
        (b) => !existingSet.has(b.duplicateKey),
      );

      let inserted = 0;
      const chunkSize = 1000;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const result = await ctx.db.transaction.createMany({ data: chunk });
        inserted += result.count;
      }

      const skippedDuplicates = prepared.length - toInsert.length;
      const flaggedCount = toInsert.reduce(
        (acc, r) => acc + (r.isFlagged ? 1 : 0),
        0,
      );

      return {
        total: input.items.length,
        prepared: prepared.length,
        inserted,
        skippedDuplicates,
        flaggedCount,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        date: z.string().datetime().optional(),
        description: z.string().min(0).optional(),
        amount: z.number().optional(),
        categoryId: z.number().int().positive().nullable().optional(),
        isFlagged: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const data: Prisma.TransactionUpdateInput = { ...rest };
      if (rest.date) data.date = new Date(rest.date);
      return ctx.db.transaction.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction.delete({ where: { id: input.id } });
      return { success: true };
    }),

  bulkUpdateCategory: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number().int().positive()).min(1),
        categoryId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { ids, categoryId } = input;
      const result = await ctx.db.transaction.updateMany({
        where: { id: { in: ids }, userId: ctx.auth.userId! },
        data: { categoryId },
      });
      return { count: result.count };
    }),

  unflagMany: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction.updateMany({
        where: { id: { in: input.ids }, userId: ctx.auth.userId! },
        data: { isFlagged: false, flagReason: [] },
      });
      return { count: result.count };
    }),
});

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildDuplicateKey(
  description: string,
  isoDate: string,
  amount: number,
): string {
  const normalized = normalizeDescription(description);
  const yyyymmdd = new Date(isoDate).toISOString().slice(0, 10);
  return `${normalized}__${yyyymmdd}__${amount}`;
}

function applyRules(
  item: { description: string; amount: number },
  rules: Array<{
    conditionType:
      | "DESCRIPTION_CONTAINS"
      | "DESCRIPTION_EXACT"
      | "AMOUNT_EQUALS"
      | "AMOUNT_GREATER_THAN"
      | "AMOUNT_LESS_THAN";
    conditionValue: string;
    actionCategoryId: number | null;
    isActive: boolean;
  }>,
): number | undefined {
  const normalizedDesc = normalizeDescription(item.description);
  for (const r of rules) {
    if (!r.isActive) continue;
    switch (r.conditionType) {
      case "DESCRIPTION_CONTAINS": {
        const needle = r.conditionValue.toLowerCase();
        if (normalizedDesc.includes(needle))
          return r.actionCategoryId ?? undefined;
        break;
      }
      case "DESCRIPTION_EXACT": {
        if (normalizedDesc === r.conditionValue.toLowerCase())
          return r.actionCategoryId ?? undefined;
        break;
      }
      case "AMOUNT_EQUALS": {
        if (item.amount === Number(r.conditionValue))
          return r.actionCategoryId ?? undefined;
        break;
      }
      case "AMOUNT_GREATER_THAN": {
        if (item.amount > Number(r.conditionValue))
          return r.actionCategoryId ?? undefined;
        break;
      }
      case "AMOUNT_LESS_THAN": {
        if (item.amount < Number(r.conditionValue))
          return r.actionCategoryId ?? undefined;
        break;
      }
    }
  }
  return undefined;
}

function evaluateAnomalies(
  description: string,
  amount: number,
): { isFlagged: boolean; flagReason: string[] } {
  const reasons: string[] = [];
  const desc = description.trim();
  if (!desc) reasons.push("MISSING_DESCRIPTION");
  if (amount > 1000) reasons.push("UNUSUAL_AMOUNT");
  return { isFlagged: reasons.length > 0, flagReason: reasons };
}
