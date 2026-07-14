"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ListingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "mark_verified" | "archive" | "unarchive") {
    setBusy(true);
    try {
      await fetch(`/api/admin/opportunities/${id}`, {
        method: "PATCH",
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
        onClick={() => act("mark_verified")}
        className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
      >
        Mark verified today
      </button>
      {status === "approved" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("archive")}
          className="rounded-md bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100 disabled:opacity-50"
        >
          Archive
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("unarchive")}
          className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100 disabled:opacity-50"
        >
          Restore
        </button>
      )}
    </div>
  );
}
