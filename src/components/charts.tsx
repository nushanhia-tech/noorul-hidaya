"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from "recharts";

/**
 * Chart primitives. Single-series charts use one hue (accent). Categorical
 * series use a validated, CVD-checked order (dataviz validator: all checks pass;
 * slot 4 has low contrast, so every chart is paired with visible values/table).
 */
export const CATEGORICAL = ["#e8691e", "#4a4ddb", "#0b9a7a", "#c99a1a"];
const AXIS = { fontSize: 12, fill: "#6b675f" };

type Datum = Record<string, string | number>;

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-line bg-paper px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-medium text-ink">{format ? format(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function SimpleBarChart({ data, x, y, name, height = 240, format, color = CATEGORICAL[0] }: { data: Datum[]; x: string; y: string; name: string; height?: number; format?: "money" | "number"; color?: string }) {
  const fmt = format === "money" ? (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n) : undefined;
  return (
    <div style={{ height }} role="img" aria-label={`${name} bar chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e2ddd3" strokeDasharray="0" />
          <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={format === "money" ? 72 : 36} tickFormatter={fmt ? (v) => fmt(v).replace("₹", "₹ ") : undefined} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(26,25,22,0.04)" }} content={<TooltipBox format={fmt} />} />
          <Bar dataKey={y} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLineChart({ data, x, series, height = 240 }: { data: Datum[]; x: string; series: { key: string; name: string }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2ddd3" />
          <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<TooltipBox />} />
          {series.map((s, i) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={CATEGORICAL[i]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} />)}
        </LineChart>
      </ResponsiveContainer>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
          {series.map((s, i) => <li key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CATEGORICAL[i] }} />{s.name}</li>)}
        </ul>
      )}
    </div>
  );
}
