import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

const Row = z.object({
  date: z.string(),
  description: z.string().default(""),
  amount: z.string(),
  categoryId: z.string().optional(),
});

export async function POST(req: Request) {
  const caller = createCaller(
    await createTRPCContext({ headers: req.headers }),
  );
  try {
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

    const rows = (parsed.data as any[])
      .map((r) => Row.safeParse(r))
      .filter((r) => r.success) as Array<{
      success: true;
      data: z.infer<typeof Row>;
    }>;

    console.log(rows);

    const toItems = rows.map(async (r) => {
      const catId = await caller.categories.create({
        name: r.data.categoryId ?? "Uncategorized",
      });
      return {
        date: new Date(r.data.date).toISOString(),
        description: r.data.description ?? "",
        amount: Number(r.data.amount),
        categoryId: catId.id!,
      };
    });

    const result = await caller.transactions.createMany({
      items: await Promise.all(toItems),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
