"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";

export default function ReviewPage() {
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [uncatPage, setUncatPage] = useState(1);
  const [pageSize] = useState(50);

  const flagged = api.transactions.list.useQuery({
    page: flaggedPage,
    pageSize,
    flagged: true,
  });
  const uncategorized = api.transactions.list.useQuery({
    page: uncatPage,
    pageSize,
    uncategorized: true,
  });

  const [selectedFlagged, setSelectedFlagged] = useState<string[]>([]);
  const [selectedUncat, setSelectedUncat] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<number | undefined>(
    undefined,
  );
  const categories = api.categories.list.useQuery();
  const unflagMany = api.transactions.unflagMany.useMutation({
    onSuccess: () => void flagged.refetch(),
  });
  const bulkUpdate = api.transactions.bulkUpdateCategory.useMutation({
    onSuccess: () => {
      void uncategorized.refetch();
      setSelectedUncat([]);
    },
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Review</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Flagged</h2>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <button
            className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
            disabled={selectedFlagged.length === 0 || unflagMany.isPending}
            onClick={() =>
              unflagMany.mutate({
                ids: selectedFlagged.map((id) => Number(id)),
              })
            }
          >
            {unflagMany.isPending
              ? "Approving…"
              : `Approve ${selectedFlagged.length}`}
          </button>
        </div>
        <DataTableSelectable
          data={
            flagged.data?.items.map((t) => ({
              id: t.id.toString(),
              date: t.date.toISOString(),
              description: t.description,
              amount: Number(t.amount),
              categoryId: t.categoryId?.toString() ?? null,
            })) ?? []
          }
          loading={flagged.isLoading}
          emptyText="No flagged transactions"
          selected={selectedFlagged}
          setSelected={setSelectedFlagged}
        />
        <div className="mt-2 flex items-center justify-between text-sm opacity-90">
          <span>
            Page {flagged.data?.page ?? flaggedPage} of{" "}
            {flagged.data
              ? Math.max(
                  1,
                  Math.ceil(
                    flagged.data.total / (flagged.data.pageSize ?? pageSize),
                  ),
                )
              : "…"}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
              disabled={flaggedPage <= 1}
              onClick={() => setFlaggedPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
              disabled={
                flagged.data
                  ? flaggedPage * pageSize >= flagged.data.total
                  : true
              }
              onClick={() => setFlaggedPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Uncategorized</h2>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <select
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
            value={bulkCategoryId ?? ""}
            onChange={(e) =>
              setBulkCategoryId(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          >
            <option value="">Choose category…</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={
              selectedUncat.length === 0 ||
              !bulkCategoryId ||
              bulkUpdate.isPending
            }
            onClick={() => {
              if (!bulkCategoryId) return;
              bulkUpdate.mutate({
                ids: selectedUncat.map((id) => Number(id)),
                categoryId: bulkCategoryId,
              });
            }}
          >
            {bulkUpdate.isPending
              ? "Categorizing…"
              : `Set ${selectedUncat.length} to category`}
          </button>
        </div>
        <DataTableSelectable
          data={
            uncategorized.data?.items.map((t) => ({
              id: t.id.toString(),
              date: t.date.toISOString(),
              description: t.description,
              amount: Number(t.amount),
              categoryId: t.categoryId?.toString() ?? null,
            })) ?? []
          }
          loading={uncategorized.isLoading}
          emptyText="No uncategorized transactions"
          selected={selectedUncat}
          setSelected={setSelectedUncat}
        />
        <div className="mt-2 flex items-center justify-between text-sm opacity-90">
          <span>
            Page {uncategorized.data?.page ?? uncatPage} of{" "}
            {uncategorized.data
              ? Math.max(
                  1,
                  Math.ceil(
                    uncategorized.data.total /
                      (uncategorized.data.pageSize ?? pageSize),
                  ),
                )
              : "…"}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
              disabled={uncatPage <= 1}
              onClick={() => setUncatPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
              disabled={
                uncategorized.data
                  ? uncatPage * pageSize >= uncategorized.data.total
                  : true
              }
              onClick={() => setUncatPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DataTableSelectable({
  data,
  loading,
  emptyText,
  selected,
  setSelected,
}: {
  data: {
    id: string;
    date: string;
    description: string;
    amount: number;
    categoryId: string | null;
  }[];
  loading: boolean;
  emptyText: string;
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const allSelected = useMemo(() => {
    const ids = data.map((t) => t.id);
    return ids.length > 0 && ids.every((id) => selected.includes(id));
  }, [data, selected]);
  return (
    <div className="overflow-x-auto rounded border border-white/20">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/10">
          <tr>
            <th className="p-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  const ids = data.map((t) => t.id);
                  if (allSelected) setSelected([]);
                  else setSelected(ids);
                }}
              />
            </th>
            <th className="p-2">Date</th>
            <th className="p-2">Description</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Category</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} className="p-4 text-center opacity-80">
                Loading…
              </td>
            </tr>
          )}
          {data.map((t) => (
            <tr key={t.id} className="odd:bg-white/5">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={(e) => {
                    setSelected(
                      e.target.checked
                        ? [...selected, t.id]
                        : selected.filter((id) => id !== t.id),
                    );
                  }}
                />
              </td>
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
              <td colSpan={5} className="p-4 text-center opacity-80">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
