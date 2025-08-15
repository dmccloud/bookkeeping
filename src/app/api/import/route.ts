import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

const Row = z.object({
  date: z.string(),
  description: z
    .string()
    .default("")
    .transform((v) => v ?? ""),
  amount: z.string(),
  category: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const caller = createCaller(
      await createTRPCContext({ headers: req.headers }),
    );
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    console.log("Parsed:", parsed);
    if (parsed.errors?.length) {
      return NextResponse.json(
        { error: "CSV parse error", details: parsed.errors },
        { status: 400 },
      );
    }

    const rawRows: unknown[] = Array.isArray(parsed.data) ? parsed.data : [];
    const parsedRows = rawRows.map((r) => Row.safeParse(r));
    // Filter out only successfully parsed rows from the CSV, discarding any that failed validation
    const rows = parsedRows.filter(
      (r): r is { success: true; data: z.infer<typeof Row> } => r.success,
    );

    // Discard rows with invalid date/amount
    const validRows = rows.filter((r) => {
      const dateOk = !Number.isNaN(new Date(r.data.date).getTime());
      const amountOk = !Number.isNaN(Number(r.data.amount));
      return dateOk && amountOk;
    });

    // Gather unique category names from CSV
    const categoryNames = Array.from(
      new Set(
        validRows
          .map((r) => (r.data.category ?? "").trim())
          .filter((n) => n.length > 0),
      ),
    );

    if (categoryNames.length > 0) {
      await db.category.createMany({
        data: categoryNames.map((name) => ({
          name,
          nameNormalized: normalizeCategoryName(name),
        })),
        skipDuplicates: true,
      });
    }

    // Load IDs for mapping name -> id
    const cats = categoryNames.length
      ? await db.category.findMany({
          where: {
            nameNormalized: { in: categoryNames.map(normalizeCategoryName) },
          },
        })
      : [];
    const nameToId = new Map(
      cats.map((c) => [c.nameNormalized, c.id] as const),
    );

    const toItems = validRows.map((r) => ({
      date: new Date(r.data.date).toISOString(),
      description: r.data.description ?? "",
      amount: Number(r.data.amount),
      categoryId: r.data.category
        ? nameToId.get(normalizeCategoryName(r.data.category))
        : undefined,
    }));

    const result = await caller.transactions.createMany({ items: toItems });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
