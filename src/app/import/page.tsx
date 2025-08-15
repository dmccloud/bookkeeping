"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setSummary(`Error: ${data?.error ?? "Upload failed"}`);
      return;
    }
    setSummary(
      `Parsed: ${data.prepared}, Inserted: ${data.inserted}, Skipped dupes: ${data.skippedDuplicates}, Flagged: ${data.flaggedCount}`,
    );
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Import CSV</h1>
      <div className="rounded border border-dashed border-white/30 p-6">
        <Input ref={fileRef} type="file" accept=".csv" className="mb-3 block" />
        <button
          className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={onUpload}
        >
          Upload
        </button>
      </div>
      {summary && <div className="mt-4 text-sm opacity-90">{summary}</div>}
    </div>
  );
}
