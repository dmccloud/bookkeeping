"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [flagged, setFlagged] = useState<boolean | undefined>(undefined);
  const [uncategorized, setUncategorized] = useState(false);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<number | undefined>(
    undefined,
  );

  const categoriesQuery = api.categories.list.useQuery();

  const listQuery = api.transactions.list.useQuery({
    page,
    pageSize,
    search: search || undefined,
    flagged,
    uncategorized: uncategorized || undefined,
    categoryId,
  });

  const bulkUpdate = api.transactions.bulkUpdateCategory.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      void listQuery.refetch();
    },
  });

  const allSelectedOnPage = useMemo(() => {
    const ids = listQuery.data?.items.map((t) => t.id) ?? [];
    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  }, [listQuery.data, selectedIds]);

  const toggleSelectAll = () => {
    const ids = listQuery.data?.items.map((t) => t.id) ?? [];
    if (ids.length === 0) return;
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Transactions</h1>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        <input
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
          placeholder="Search description..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
          value={categoryId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setCategoryId(val ? Number(val) : undefined);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
          value={
            flagged === undefined ? "all" : flagged ? "flagged" : "unflagged"
          }
          onChange={(e) => {
            const val = e.target.value;
            setFlagged(
              val === "all" ? undefined : val === "flagged" ? true : false,
            );
            setPage(1);
          }}
        >
          <option value="all">All</option>
          <option value="flagged">Flagged</option>
          <option value="unflagged">Unflagged</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={uncategorized}
            onChange={(e) => {
              setUncategorized(e.target.checked);
              setPage(1);
            }}
          />
          Uncategorized only
        </label>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelectedOnPage}
            onChange={toggleSelectAll}
          />
          Select all on page
        </label>
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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={
            selectedIds.length === 0 || !bulkCategoryId || bulkUpdate.isPending
          }
          onClick={() => {
            if (!bulkCategoryId) return;
            bulkUpdate.mutate({ ids: selectedIds, categoryId: bulkCategoryId });
          }}
        >
          {bulkUpdate.isPending
            ? "Applying…"
            : `Apply to ${selectedIds.length} selected`}
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-white/20">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="p-2"></th>
              <th className="p-2">Date</th>
              <th className="p-2">Description</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Category</th>
              <th className="p-2">Flagged</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr>
                <td colSpan={6} className="p-4 text-center opacity-80">
                  Loading…
                </td>
              </tr>
            )}
            {listQuery.data?.items.map((t) => {
              const catLabel =
                categories.find((c) => c.id === t.categoryId)?.name ?? "—";
              return (
                <tr key={t.id} className="odd:bg-white/5">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) =>
                          e.target.checked
                            ? [...prev, t.id]
                            : prev.filter((id) => id !== t.id),
                        );
                      }}
                    />
                  </td>
                  <td className="p-2">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="p-2">{t.description}</td>
                  <td className="p-2 tabular-nums">
                    {Number(t.amount).toFixed(2)}
                  </td>
                  <td className="p-2">{catLabel}</td>
                  <td className="p-2">{t.isFlagged ? "Yes" : "No"}</td>
                </tr>
              );
            })}
            {listQuery.data && listQuery.data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center opacity-80">
                  No transactions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div>
          Page {listQuery.data?.page ?? page} of{" "}
          {listQuery.data
            ? Math.max(
                1,
                Math.ceil(
                  listQuery.data.total / (listQuery.data.pageSize ?? pageSize),
                ),
              )
            : "…"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="rounded border border-white/30 px-2 py-1 disabled:opacity-50"
            disabled={
              listQuery.data ? page * pageSize >= listQuery.data.total : true
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
