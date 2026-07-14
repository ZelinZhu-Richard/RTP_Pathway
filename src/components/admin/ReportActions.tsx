"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "resolve" | "dismiss") {
    setBusy(true);
    try {
      await fetch(`/api/admin/reports/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => act("resolve")}
        className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
      >
        Resolved (listing fixed)
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act("dismiss")}
        className="rounded-md bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100 disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  );
}
