"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export default function ReviewPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const flagged = api.transactions.list.useQuery({
    page,
    pageSize,
    flagged: true,
  });
  const uncategorized = api.transactions.list.useQuery({
    page,
    pageSize,
    uncategorized: true,
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Review</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Flagged</h2>
        <DataTable
          data={flagged.data?.items ?? []}
          loading={flagged.isLoading}
          emptyText="No flagged transactions"
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Uncategorized</h2>
        <DataTable
          data={uncategorized.data?.items ?? []}
          loading={uncategorized.isLoading}
          emptyText="No uncategorized transactions"
        />
      </section>
    </div>
  );
}

function DataTable({
  data,
  loading,
  emptyText,
}: {
  data: any[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-white/20">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/10">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Description</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Category</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="p-4 text-center opacity-80">
                Loading…
              </td>
            </tr>
          )}
          {data.map((t) => (
            <tr key={t.id} className="odd:bg-white/5">
              <td className="p-2">{new Date(t.date).toLocaleDateString()}</td>
              <td className="p-2">{t.description}</td>
              <td className="p-2 tabular-nums">
                {Number(t.amount).toFixed(2)}
              </td>
              <td className="p-2">{t.categoryId ?? "—"}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center opacity-80">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
