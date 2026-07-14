"use client";

import { useEffect, useState } from "react";

// Saved opportunities live in localStorage only — no student accounts.
const KEY = "rtp:saved";
export const SAVE_LIMIT = 20;
export const COMPARE_LIMIT = 3;

export function getSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setSavedIds(ids: string[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, SAVE_LIMIT)));
  window.dispatchEvent(new Event("rtp:saved-changed"));
}

export function useSavedIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(getSavedIds());
    sync();
    window.addEventListener("rtp:saved-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rtp:saved-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}

export function SaveButton({ id }: { id: string }) {
  const saved = useSavedIds().includes(id);
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save this opportunity"}
      title={saved ? "Remove from saved" : "Save this opportunity"}
      onClick={() => {
        const ids = getSavedIds();
        setSavedIds(saved ? ids.filter((x) => x !== id) : [...ids, id]);
      }}
      className={`rounded-full p-1.5 ring-1 transition ${
        saved
          ? "bg-teal-700 text-white ring-teal-700"
          : "bg-white text-stone-400 ring-stone-200 hover:text-teal-700 hover:ring-teal-300"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
