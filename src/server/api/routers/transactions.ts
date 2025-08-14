import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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
      const where: any = { userId: ctx.auth.userId };
      if (categoryId) where.categoryId = categoryId;
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
      return ctx.db.transaction.create({
        data: {
          userId: ctx.auth.userId!,
          date: new Date(input.date),
          description: input.description,
          amount: input.amount,
          categoryId: input.categoryId!,
          duplicateKey,
        },
      });
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
      const data: any = { ...rest };
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
