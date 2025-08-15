"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

const conditionOptions = [
  "DESCRIPTION_CONTAINS",
  "DESCRIPTION_EXACT",
  "AMOUNT_EQUALS",
  "AMOUNT_GREATER_THAN",
  "AMOUNT_LESS_THAN",
] as const;

export default function RulesPage() {
  const rulesQuery = api.rules.list.useQuery();
  const categoriesQuery = api.categories.list.useQuery();
  const createRule = api.rules.create.useMutation({
    onSuccess: () => rulesQuery.refetch(),
  });
  const updateRule = api.rules.update.useMutation({
    onSuccess: () => rulesQuery.refetch(),
  });
  const deleteRule = api.rules.delete.useMutation({
    onSuccess: () => rulesQuery.refetch(),
  });
  const applyAll = api.rules.applyToUncategorized.useMutation();

  const [name, setName] = useState("");
  const [conditionType, setConditionType] = useState<
    (typeof conditionOptions)[number]
  >("DESCRIPTION_CONTAINS");
  const [conditionValue, setConditionValue] = useState("");
  const [actionCategoryId, setActionCategoryId] = useState<number | undefined>(
    undefined,
  );

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Rules</h1>

      <div className="mb-6 rounded border border-white/20 p-4">
        <h2 className="mb-2 font-medium">Create Rule</h2>
        <div className="mb-3 flex items-center gap-2">
          <button
            className="rounded border border-white/30 px-2 py-1 text-sm disabled:opacity-50"
            onClick={() => applyAll.mutate()}
            disabled={applyAll.isPending}
          >
            {applyAll.isPending ? "Applying…" : "Apply to Uncategorized"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
            placeholder="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
            value={conditionType}
            onChange={(e) => setConditionType(e.target.value as any)}
          >
            {conditionOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
            placeholder="Condition value"
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
          />
          <select
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
            value={actionCategoryId ?? ""}
            onChange={(e) =>
              setActionCategoryId(
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
        </div>
        <div className="mt-3">
          <button
            className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!name || !conditionValue || createRule.isPending}
            onClick={() =>
              createRule.mutate({
                name,
                conditionType,
                conditionValue,
                actionCategoryId,
              })
            }
          >
            {createRule.isPending ? "Creating…" : "Create Rule"}
          </button>
        </div>
      </div>

      <div className="rounded border border-white/20">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Condition</th>
              <th className="p-2">Value</th>
              <th className="p-2">Category</th>
              <th className="p-2">Active</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rulesQuery.data?.map((r) => {
              const catName =
                categories.find((c) => c.id === r.actionCategoryId)?.name ??
                "—";
              return (
                <tr key={r.id} className="odd:bg-white/5">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.conditionType}</td>
                  <td className="p-2">{r.conditionValue}</td>
                  <td className="p-2">{catName}</td>
                  <td className="p-2">{r.isActive ? "Yes" : "No"}</td>
                  <td className="p-2">
                    <button
                      className="mr-2 rounded border border-white/30 px-2 py-1 text-xs"
                      onClick={() =>
                        updateRule.mutate({ id: r.id, isActive: !r.isActive })
                      }
                    >
                      {r.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="rounded border border-red-400 px-2 py-1 text-xs text-red-300"
                      onClick={() => deleteRule.mutate({ id: r.id })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {rulesQuery.data && rulesQuery.data.length === 0 && (
              <tr>
                <td className="p-4 text-center opacity-80" colSpan={6}>
                  No rules
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
