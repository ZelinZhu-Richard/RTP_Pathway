"use client";

import type { Filters } from "@/lib/search";
import { taxonomy } from "@/lib/taxonomy";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-normal text-stone-800 focus:border-teal-500 focus:outline-none"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterPanel({ filters, onChange }: Props) {
  const set = (key: keyof Filters) => (value: string) =>
    onChange({ ...filters, [key]: value === "" ? undefined : key === "grade" || key === "deadlineWithinDays" ? Number(value) : value });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <Select
        label="Category"
        value={filters.category ?? ""}
        onChange={set("category")}
        options={taxonomy.categories.map((c) => ({ value: c.id, label: c.label ?? c.id }))}
      />
      <Select
        label="Grade"
        value={filters.grade?.toString() ?? ""}
        onChange={set("grade")}
        options={[6, 7, 8, 9, 10, 11, 12].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
      />
      <Select
        label="City"
        value={filters.city ?? ""}
        onChange={set("city")}
        options={taxonomy.cities.map((c) => ({ value: c.id, label: c.id }))}
      />
      <Select
        label="Format"
        value={filters.format ?? ""}
        onChange={set("format")}
        options={taxonomy.formats.map((f) => ({ value: f.id, label: f.label ?? f.id }))}
      />
      <Select
        label="Cost"
        value={filters.cost ?? ""}
        onChange={set("cost")}
        options={taxonomy.cost_types.map((c) => ({ value: c.id, label: c.label ?? c.id }))}
      />
      <Select
        label="Pay"
        value={filters.compensation ?? ""}
        onChange={set("compensation")}
        options={[
          { value: "any_pay", label: "Paid or stipend" },
          ...taxonomy.compensation_types.map((c) => ({ value: c.id, label: c.label ?? c.id })),
        ]}
      />
      <Select
        label="Schedule"
        value={filters.schedule ?? ""}
        onChange={set("schedule")}
        options={taxonomy.schedules.map((s) => ({ value: s.id, label: s.label ?? s.id }))}
      />
      <Select
        label="Deadline"
        value={filters.deadlineWithinDays?.toString() ?? ""}
        onChange={set("deadlineWithinDays")}
        options={[
          { value: "7", label: "This week" },
          { value: "30", label: "This month" },
          { value: "90", label: "Next 3 months" },
        ]}
      />
    </div>
  );
}
