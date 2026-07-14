import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { searchEvents } from "@/db/schema";
import { Filters, hasActiveFilters } from "@/lib/search";

/**
 * Anonymous demand logging: what was asked and how many results came back.
 * Deliberately stores no IP, session, or user identifiers.
 */
export function logSearchEvent(mode: "keyword" | "nl", queryText: string | null, filters: Filters, resultCount: number): void {
  if (!queryText && !hasActiveFilters(filters)) return;
  try {
    const loggable: Partial<Filters> = { ...filters };
    delete loggable.q;
    delete loggable.keywords;
    delete loggable.sort;
    db.insert(searchEvents)
      .values({
        id: randomUUID(),
        mode,
        queryText: queryText?.slice(0, 300) ?? null,
        filters: JSON.stringify(loggable),
        resultCount,
      })
      .run();
  } catch {
    // analytics must never break search
  }
}
