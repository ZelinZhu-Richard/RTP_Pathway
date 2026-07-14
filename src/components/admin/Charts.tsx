"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Reference dataviz palette (light mode). Single-hue sequential for magnitude
// charts; the fixed status palette (with visible labels — never color alone)
// for the freshness breakdown.
const SEQ_BLUE = "#2a78d6";
const SEQ_AQUA = "#1baf7a";
const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const STATUS: Record<string, string> = {
  verified: "#0ca30c",
  stale: "#fab219",
  never_verified: "#ec835a",
  expired: "#d03b3b",
  archived: "#a8a29e",
};

interface Datum {
  label: string;
  count: number;
}

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${GRID}`,
  background: "#fcfcfb",
  fontSize: 12,
  color: "#0b0b0b",
};

function HBarChart({ data, color }: { data: Datum[]; color: string }) {
  const height = Math.max(120, data.length * 34 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          tick={{ fontSize: 11, fill: "#52514e" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={color} barSize={16} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#52514e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }: { data: Datum[] }) {
  return <HBarChart data={data} color={SEQ_BLUE} />;
}

export function CityChart({ data }: { data: Datum[] }) {
  return <HBarChart data={data} color={SEQ_AQUA} />;
}

export function SearchChart({ data }: { data: Datum[] }) {
  return <HBarChart data={data} color={SEQ_BLUE} />;
}

/** Single stacked horizontal bar: listing pipeline state, status-colored with legend + counts. */
export function FreshnessChart({ data }: { data: { key: string; label: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  const row = Object.fromEntries(data.map((d) => [d.key, d.count]));
  return (
    <div>
      <ResponsiveContainer width="100%" height={64}>
        <BarChart data={[{ name: "listings", ...row }]} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip cursor={false} contentStyle={tooltipStyle} />
          {data
            .filter((d) => d.count > 0)
            .map((d) => (
              <Bar key={d.key} dataKey={d.key} name={d.label} stackId="s" barSize={28} fill={STATUS[d.key]} stroke="#fcfcfb" strokeWidth={2} />
            ))}
        </BarChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATUS[d.key] }} />
            {d.label}: <span className="font-semibold text-stone-800">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
